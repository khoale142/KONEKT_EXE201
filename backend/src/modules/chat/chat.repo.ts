import { pool } from "../../config/db";

export type ChatMessage = {
  id: number;
  role: "system" | "user" | "assistant" | "function";
  content: string;
  function_name?: string | null;
  function_call_id?: string | null;
  created_at: Date;
};

export type Conversation = {
  id: number;
  customer_id: number;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
};

export async function getConversationById(conversationId: number): Promise<Conversation | null> {
  const result = await pool.query(
    `SELECT * FROM coffee_chain_db.chat_conversations WHERE id = $1 LIMIT 1`,
    [conversationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Conversation;
}

/**
 * Tạo hoặc lấy conversation hiện tại của customer
 */
export async function getOrCreateConversation(customerId: number): Promise<Conversation> {
  try {
    // Tìm conversation gần nhất (trong 24h)
    // Thử schema coffee_chain_db trước, nếu không có thì dùng public
    const result = await pool.query(
      `SELECT * FROM coffee_chain_db.chat_conversations 
       WHERE customer_id = $1 
       AND updated_at > NOW() - INTERVAL '24 hours'
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [customerId]
    );

    if (result.rows.length > 0) {
      return result.rows[0] as Conversation;
    }

    // Tạo conversation mới
    const newResult = await pool.query(
      `INSERT INTO coffee_chain_db.chat_conversations (customer_id, metadata)
       VALUES ($1, '{}'::jsonb)
       RETURNING *`,
      [customerId]
    );

    return newResult.rows[0] as Conversation;
  } catch (error: any) {
    // Kiểm tra nếu table không tồn tại
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      throw new Error(
        "Chat database tables not found. Please run migration: npx tsx backend/src/modules/chat/migrate.ts"
      );
    }
    // Kiểm tra lỗi foreign key
    if (error?.code === "23503" || error?.message?.includes("foreign key")) {
      console.error("[Chat Repo] Foreign key error - customer might not exist:", {
        customerId,
        error: error.message,
      });
      throw new Error(
        `Customer with ID ${customerId} does not exist in database. Please check customer table.`
      );
    }
    console.error("[Chat Repo] Error in getOrCreateConversation:", {
      error: error.message,
      code: error.code,
      detail: error.detail,
      customerId,
    });
    throw error;
  }
}

/**
 * Lấy lịch sử messages của conversation (giới hạn 20 messages gần nhất)
 */
export async function getConversationMessages(
  conversationId: number,
  limit: number = 20
): Promise<ChatMessage[]> {
  try {
    const result = await pool.query(
      `SELECT id, role, content, function_name, function_call_id, created_at
       FROM coffee_chain_db.chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );

    // Đảo ngược để có thứ tự từ cũ đến mới
    return result.rows.reverse() as ChatMessage[];
  } catch (error: any) {
    // Kiểm tra nếu table không tồn tại
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      throw new Error(
        "Chat database tables not found. Please run migration: npx tsx backend/src/modules/chat/migrate.ts"
      );
    }
    console.error("[Chat Repo] Error in getConversationMessages:", error);
    throw error;
  }
}

/**
 * Lưu message vào database
 */
export async function saveMessage(params: {
  conversationId: number;
  role: "system" | "user" | "assistant" | "function";
  content: string;
  functionName?: string;
  functionCallId?: string;
}): Promise<ChatMessage> {
  try {
    const result = await pool.query(
      `INSERT INTO coffee_chain_db.chat_messages (conversation_id, role, content, function_name, function_call_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, content, function_name, function_call_id, created_at`,
      [
        params.conversationId,
        params.role,
        params.content,
        params.functionName || null,
        params.functionCallId || null,
      ]
    );

    // Cập nhật updated_at của conversation
    await pool.query(
      `UPDATE coffee_chain_db.chat_conversations 
       SET updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [params.conversationId]
    );

    return result.rows[0] as ChatMessage;
  } catch (error: any) {
    // Kiểm tra nếu table không tồn tại
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      throw new Error(
        "Chat database tables not found. Please run migration: npx tsx backend/src/modules/chat/migrate.ts"
      );
    }
    console.error("[Chat Repo] Error in saveMessage:", error);
    throw error;
  }
}

export async function updateConversationMetadata(
  conversationId: number,
  metadataPatch: Record<string, unknown>
): Promise<Conversation | null> {
  const result = await pool.query(
    `
    UPDATE coffee_chain_db.chat_conversations
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [conversationId, JSON.stringify(metadataPatch)]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Conversation;
}

/**
 * Lưu nhiều messages cùng lúc (cho function calls)
 */
export async function saveMessages(messages: Array<{
  conversationId: number;
  role: "system" | "user" | "assistant" | "function";
  content: string;
  functionName?: string;
  functionCallId?: string;
}>): Promise<void> {
  if (messages.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const msg of messages) {
      await client.query(
        `INSERT INTO coffee_chain_db.chat_messages (conversation_id, role, content, function_name, function_call_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          msg.conversationId,
          msg.role,
          msg.content,
          msg.functionName || null,
          msg.functionCallId || null,
        ]
      );
    }

    // Cập nhật updated_at của conversation
    if (messages.length > 0) {
      await client.query(
        `UPDATE coffee_chain_db.chat_conversations 
         SET updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [messages[0].conversationId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho table_availability (câu hỏi động)
 * Query để kiểm tra bàn trống hôm nay
 */
export class TableAvailabilityHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "table_availability" && intent.handlerType === "dynamic";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    const { message } = context;
    const normalizedMessage = this.normalizeText(message);

    try {
      // Extract ngày từ message (hôm nay, ngày mai, hoặc ngày cụ thể)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let targetDate = today;
      if (normalizedMessage.includes("ngay mai") || normalizedMessage.includes("mai")) {
        targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (normalizedMessage.includes("hom nay") || normalizedMessage.includes("hôm nay")) {
        targetDate = today;
      }

      const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

      // Query 1: Kiểm tra xem có bảng tables không (bàn vật lý)
      // Nếu có bảng tables, query bàn trống
      // Nếu không có, query từ reservations để tính bàn đã đặt
      
      let availableTables: any[] = [];
      let totalTables = 0;

      try {
        // Thử query bảng tables nếu có
        const tablesResult = await pool.query(`
          SELECT COUNT(*) as total
          FROM tables
          WHERE is_active = TRUE
        `);

        if (tablesResult.rows.length > 0) {
          totalTables = Number(tablesResult.rows[0].total);

          // Query bàn trống (bàn không có reservation trong ngày)
          const availableResult = await pool.query(`
            SELECT t.id, t.table_number, t.capacity, t.location
            FROM tables t
            WHERE t.is_active = TRUE
              AND t.id NOT IN (
                SELECT DISTINCT table_id
                FROM reservations
                WHERE reservation_date = $1
                  AND status IN ('pending', 'confirmed')
                  AND table_id IS NOT NULL
              )
            ORDER BY t.table_number
            LIMIT 10
          `, [dateStr]);

          availableTables = availableResult.rows;
        } else {
          // Nếu không có bảng tables, tính từ reservations
          // Giả sử có 20 bàn (1-20)
          totalTables = 20;
          
          const reservedResult = await pool.query(`
            SELECT DISTINCT table_id
            FROM reservations
            WHERE reservation_date = $1
              AND status IN ('pending', 'confirmed')
              AND table_id IS NOT NULL
          `, [dateStr]);

          const reservedTableIds = reservedResult.rows.map((r: any) => r.table_id);
          
          // Tạo danh sách bàn trống (giả sử bàn 1-20)
          for (let i = 1; i <= 20; i++) {
            if (!reservedTableIds.includes(i)) {
              availableTables.push({
                id: i,
                table_number: i,
                capacity: 4, // Mặc định 4 người
                location: "Khu vực chính",
              });
            }
          }
          availableTables = availableTables.slice(0, 10);
        }
      } catch (tableError: any) {
        // Nếu bảng tables không tồn tại, dùng cách tính từ reservations
        console.log("[Table Availability] Tables table not found, using reservation-based calculation");
        
        totalTables = 20; // Giả sử có 20 bàn
        
        try {
          const reservedResult = await pool.query(`
            SELECT DISTINCT table_id
            FROM reservations
            WHERE reservation_date = $1
              AND status IN ('pending', 'confirmed')
              AND table_id IS NOT NULL
          `, [dateStr]);

          const reservedTableIds = reservedResult.rows.map((r: any) => r.table_id);
          
          for (let i = 1; i <= 20; i++) {
            if (!reservedTableIds.includes(i)) {
              availableTables.push({
                table_number: i,
                capacity: 4,
              });
            }
          }
          availableTables = availableTables.slice(0, 10);
        } catch (reservationError: any) {
          // Nếu cả reservations cũng không có
          console.error("[Table Availability] Both tables and reservations not found");
        }
      }

      // Format response
      const dateText = targetDate.toLocaleDateString("vi-VN", { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });

      if (availableTables.length === 0) {
        return {
          answer: `Xin lỗi, ${dateText} đã hết bàn trống. Vui lòng chọn ngày khác hoặc liên hệ hotline 1900xxxx để được tư vấn!`,
          intentCode: "table_availability",
        };
      }

      let answer = `Có ${availableTables.length} bàn trống ${dateText}:\n\n`;
      
      for (const table of availableTables) {
        answer += `🪑 Bàn số ${table.table_number}`;
        if (table.capacity) {
          answer += ` (${table.capacity} người)`;
        }
        if (table.location) {
          answer += ` - ${table.location}`;
        }
        answer += "\n";
      }

      if (availableTables.length < totalTables) {
        answer += `\n💡 Tổng cộng có ${totalTables} bàn, ${availableTables.length} bàn còn trống.`;
      }

      answer += `\n\n📞 Để đặt bàn, vui lòng gọi hotline 1900xxxx hoặc đặt qua ứng dụng!`;

      return {
        answer: answer.trim(),
        intentCode: "table_availability",
        metadata: {
          date: dateStr,
          availableCount: availableTables.length,
          totalCount: totalTables,
        },
      };
    } catch (error: any) {
      console.error("[Table Availability Handler] Error:", error);
      
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return {
          answer: "Thông tin bàn trống đang được cập nhật. Vui lòng liên hệ hotline 1900xxxx để đặt bàn trực tiếp!",
          intentCode: "table_availability",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi kiểm tra bàn trống. Vui lòng thử lại sau hoặc gọi hotline 1900xxxx.",
        intentCode: "table_availability",
      };
    }
  }
}

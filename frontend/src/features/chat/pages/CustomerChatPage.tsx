import { useState, useRef, useEffect } from "react";
import CustomerLayout from "../../../shared/layouts/CustomerLayout";
import Button from "../../../shared/components/Button";
import { getCustomerChatMessages, sendCustomerChatMessage } from "../api/chat.api";

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
};

export default function CustomerChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLoadingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load lịch sử chat riêng của customer khi mở trang
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const history = await getCustomerChatMessages();
        if (!cancelled) {
          setMessages(
            history.map((m) => ({
              id: `hist-${m.id}`,
              from: m.from,
              text: m.text,
            }))
          );
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input khi loading chuyển từ true -> false (sau khi gửi xong tin nhắn)
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      inputRef.current?.focus();
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      from: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendCustomerChatMessage(trimmed);
      const answer: string =
        res.answer ?? "Xin lỗi, tôi chưa thể trả lời câu hỏi này.";

      const botMsg: ChatMessage = {
        id: `${Date.now()}-bot`,
        from: "bot",
        text: answer,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const botMsg: ChatMessage = {
        id: `${Date.now()}-bot`,
        from: "bot",
        text: e?.response?.data?.message || "Xin lỗi, hiện chatbot đang gặp sự cố. Vui lòng thử lại sau.",
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  return (
    <CustomerLayout>
      <div style={{ flex: 1, padding: 32, maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <div className="cafe-card" style={{ padding: 32 }}>
          <h1 className="cafe-title">Trợ lý AI KOHI</h1>
          <p className="cafe-subtitle">Hỏi tôi về menu, ưu đãi, giờ mở cửa, điểm tích lũy...</p>

          <div className="chat-container">
            <div className="chat-messages">
              {loadingHistory && (
                <div className="chat-empty">Đang tải lịch sử chat...</div>
              )}
              {!loadingHistory && messages.length === 0 && !loading && (
                <div className="chat-empty">
                  Chào mừng bạn đến với trợ lý AI của KOHI! 👋
                  <br />
                  Hãy đặt câu hỏi để tôi có thể giúp bạn.
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`chat-message ${m.from === "user" ? "chat-message-user" : "chat-message-bot"}`}>
                  <div className="chat-bubble">
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="chat-message chat-message-bot">
                  <div className="chat-bubble chat-bubble-loading">
                    Đang suy nghĩ...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={onSubmit} className="chat-form">
              <input
                ref={inputRef}
                type="text"
                placeholder="Nhập câu hỏi của bạn..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  outline: "none",
                }}
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                Gửi
              </Button>
            </form>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}

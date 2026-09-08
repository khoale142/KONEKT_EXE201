import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ChatButton() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={() => navigate("/customer/chat")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: "50%",
        backgroundColor: isHovered ? "#15803d" : "#16a34a",
        color: "#ffffff",
        border: "none",
        boxShadow: "0 4px 12px rgba(22, 163, 74, 0.4)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        zIndex: 1000,
        transition: "background-color 0.2s, transform 0.2s",
        transform: isHovered ? "scale(1.1)" : "scale(1)",
      }}
      title="Chat với trợ lý AI"
    >
      💬
    </button>
  );
}

import api from "../../../lib/http/axios";

export type ChatMessageDto = {
  id: number;
  from: "user" | "bot";
  text: string;
};

export async function getCustomerChatMessages(): Promise<ChatMessageDto[]> {
  const { data } = await api.get<{ messages: ChatMessageDto[] }>("/chat/customer/messages");
  return data.messages ?? [];
}

export async function sendCustomerChatMessage(message: string): Promise<{
  answer: string;
  conversationId?: number;
  intentCode?: string;
}> {
  const { data } = await api.post<{
    answer: string;
    conversationId?: number;
    intentCode?: string;
  }>("/chat/customer", { message });
  return data;
}

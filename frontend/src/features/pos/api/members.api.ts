import api from "../../../lib/http/axios";

export type PosMember = {
  id: number;
  fullName: string;
  points: number;
};

export async function posFindMember(phone: string) {
  const r = await api.get("/pos/members/find", { params: { phone } });
  return r.data as { member: null | PosMember };
}

export async function posQuickCreateMember(payload: {
  fullName: string;
  phone: string;
}) {
  const r = await api.post("/pos/members/quick-create", payload);
  return r.data as {
    member: PosMember;
    tempPassword: string;
    mustChangePassword: true;
  };
}
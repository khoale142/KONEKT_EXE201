const ACCESS = "cc_access";
const REFRESH = "cc_refresh";

export const token = {
  getAccess: () => localStorage.getItem(ACCESS),
  setAccess: (v: string) => localStorage.setItem(ACCESS, v),
  getRefresh: () => localStorage.getItem(REFRESH),
  setRefresh: (v: string) => localStorage.setItem(REFRESH, v),
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};
export const isEmail = (s?: string | null) => !!s && s.includes("@");

export const safePersonName = (name?: string | null, fallback = "Client") => {
  const n = (name || "").trim();
  if (!n) return fallback;
  if (isEmail(n)) return fallback;
  return n;
};

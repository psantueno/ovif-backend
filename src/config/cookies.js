const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_TTL = 10 * 60;          // 10 minutos en segundos
const REFRESH_TOKEN_TTL = 8 * 60 * 60;     // 8 horas en segundos

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax",
};

export const ACCESS_COOKIE_NAME = IS_PROD ? "__Host-ovif_at" : "ovif_at";
export const REFRESH_COOKIE_NAME = IS_PROD ? "__Host-ovif_rt" : "ovif_rt";

export const ACCESS_COOKIE_OPTS = {
  ...COOKIE_BASE,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL * 1000, // express usa milisegundos
};

export const REFRESH_COOKIE_OPTS = {
  ...COOKIE_BASE,
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL * 1000,
};

// __Host- prefix requiere Path=/ — ajustamos si es prod
if (IS_PROD) {
  REFRESH_COOKIE_OPTS.path = "/";
}

export const CLEAR_ACCESS_COOKIE_OPTS = {
  ...COOKIE_BASE,
  path: ACCESS_COOKIE_OPTS.path,
  maxAge: 0,
};

export const CLEAR_REFRESH_COOKIE_OPTS = {
  ...COOKIE_BASE,
  path: REFRESH_COOKIE_OPTS.path,
  maxAge: 0,
};

export { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL };

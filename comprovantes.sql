-- Fotos ficam fora do JSON sincronizado pelo caixa.
CREATE TABLE IF NOT EXISTS public.js_caixa_foto_celulares (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES public.js_caixa_usuarios(id),
 session_id text NOT NULL UNIQUE,
 box integer NOT NULL CHECK (box IN (1,2)),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.js_caixa_comprovantes (
 sale_id text PRIMARY KEY,
 session_id text NOT NULL,
 box integer NOT NULL CHECK (box IN (1,2)),
 uploaded_by text NOT NULL REFERENCES public.js_caixa_usuarios(id),
 image bytea NOT NULL CHECK (octet_length(image) BETWEEN 4 AND 524288),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS js_caixa_comprovantes_session ON public.js_caixa_comprovantes(session_id);

-- Preserva usuários e permite um perfil sem vínculo com caixa.
ALTER TABLE public.js_caixa_usuarios DROP CONSTRAINT js_caixa_usuarios_role_check,
 ADD CONSTRAINT js_caixa_usuarios_role_check CHECK(role IN ('admin','caixa','entregador')),
 DROP CONSTRAINT js_caixa_usuarios_check,
 ADD CONSTRAINT js_caixa_usuarios_check CHECK((role IN ('admin','entregador') AND box IS NULL) OR (role='caixa' AND box IS NOT NULL));

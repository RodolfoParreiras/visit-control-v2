export type InitialAdmin = {
  name: string;
  login: string;
  password: string;
};

export function validateInitialAdmin(credentials: InitialAdmin): InitialAdmin {
  const name = credentials.name.trim();
  const login = credentials.login.trim();
  if (!name) throw new Error("O nome do administrador inicial é obrigatório");
  if (!login) throw new Error("O login do administrador inicial é obrigatório");
  if (credentials.password.length < 8) {
    throw new Error(
      "A senha do administrador inicial deve ter pelo menos 8 caracteres",
    );
  }
  return { name, login, password: credentials.password };
}

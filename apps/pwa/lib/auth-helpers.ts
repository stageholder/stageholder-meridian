export function setLoggedInFlag(): void {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `logged_in=1; path=/; max-age=2592000; SameSite=Lax${secure}`;
}

export function clearLoggedInFlag(): void {
  document.cookie = "logged_in=; path=/; max-age=0";
}

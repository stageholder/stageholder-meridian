export function setLoggedInFlag(): void {
  document.cookie = "logged_in=1; path=/; max-age=604800; samesite=lax";
}

export function clearLoggedInFlag(): void {
  document.cookie = "logged_in=; path=/; max-age=0";
}

/** Edge-safe shared-password check. The cookie stores the password (httpOnly), compared here. */
export function isValidAdminToken(token?: string): boolean {
  const pw = process.env.ADMIN_PASSWORD ?? ''
  return !!pw && token === pw
}

/**
 * La cookie de admin, leída de un `Request` pelado (sin `NextRequest`), para que las
 * rutas que la exigen se puedan testear construyendo el Request a mano. La usan las
 * rutas de API con efectos que no deben quedar a merced de la oscuridad de la URL
 * (borrar proyectos, editar el entregable); el proxy solo protege las páginas.
 */
export function esAdminRequest(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? ''
  const token = cookie.split(/;\s*/).find(c => c.startsWith('admin='))?.slice('admin='.length)
  return isValidAdminToken(token === undefined ? undefined : decodeURIComponent(token))
}

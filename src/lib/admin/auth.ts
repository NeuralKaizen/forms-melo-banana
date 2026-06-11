/** Edge-safe shared-password check. The cookie stores the password (httpOnly), compared here. */
export function isValidAdminToken(token?: string): boolean {
  const pw = process.env.ADMIN_PASSWORD ?? ''
  return !!pw && token === pw
}

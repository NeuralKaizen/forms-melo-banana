/**
 * Lo que se le devuelve a Claude como error de herramienta. El mensaje es para que
 * corrija solo: dice qué se esperaba, no solo que algo falló.
 */
export class ErrorDeHerramienta extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeHerramienta'
  }
}

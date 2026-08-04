import { NextResponse } from 'next/server'
import { docRecursoProtegido } from '@/lib/oauth/metadata'

// Sin CORS el descubrimiento desde un cliente de navegador falla, y el documento es
// público por definición: no dice nada que no esté ya en la URL del conector.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }

export async function GET() {
  return NextResponse.json(docRecursoProtegido(), { headers: CORS })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

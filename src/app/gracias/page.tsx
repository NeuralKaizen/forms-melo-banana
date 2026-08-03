import { LogoBlock } from '@/components/Brand'

export default function Gracias() {
  return <main className="grid min-h-screen place-items-center bg-cream px-6 text-center">
    <div className="flex flex-col items-center">
      <LogoBlock />
      <h1 className="mt-7 font-serif text-3xl font-medium text-ink md:text-4xl">¡Gracias por compartir tu&nbsp;<span className="underline-banana">visión</span>!</h1>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#7a7060]">
        Recibimos tus respuestas. El equipo de Mellow &amp; Banana ya está con esto. 🍌
      </p>
    </div>
  </main>
}

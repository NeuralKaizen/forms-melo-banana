import type { ReactNode } from 'react'
import type { SectionView } from '@/lib/script/flow'
import { SectionNav } from './SectionNav'

export function InterviewLayout({ sections, currentIndex, answeredIds, onJump, children }: {
  sections: SectionView[]
  currentIndex: number
  answeredIds: Set<string>
  onJump: (index: number) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col bg-cream px-6 py-6 md:min-h-[80vh] md:max-w-5xl md:flex-row md:gap-10 md:rounded-[2rem] md:px-10 md:py-9 md:shadow-2xl">
        <aside className="md:w-60 md:shrink-0 md:border-r md:border-black/5 md:pr-8">
          <SectionNav sections={sections} currentIndex={currentIndex} answeredIds={answeredIds} onJump={onJump} />
        </aside>
        <div className="flex flex-1 flex-col justify-between pt-6 md:pt-0">
          {children}
        </div>
      </div>
    </div>
  )
}

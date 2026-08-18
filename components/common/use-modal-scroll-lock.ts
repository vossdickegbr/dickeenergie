'use client'

import { useEffect } from 'react'

let activeLocks = 0
let savedScrollY = 0
let savedBodyStyles: Partial<Record<'overflow' | 'position' | 'top' | 'left' | 'right' | 'width' | 'paddingRight', string>> | null = null
let savedHtmlOverflow = ''

function lockPageScroll() {
  if (activeLocks === 0) {
    savedScrollY = window.scrollY
    savedBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
    }
    savedHtmlOverflow = document.documentElement.style.overflow

    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
  }
  activeLocks += 1
}

function unlockPageScroll() {
  activeLocks = Math.max(0, activeLocks - 1)
  if (activeLocks !== 0 || !savedBodyStyles) return

  document.documentElement.style.overflow = savedHtmlOverflow
  document.body.style.overflow = savedBodyStyles.overflow ?? ''
  document.body.style.position = savedBodyStyles.position ?? ''
  document.body.style.top = savedBodyStyles.top ?? ''
  document.body.style.left = savedBodyStyles.left ?? ''
  document.body.style.right = savedBodyStyles.right ?? ''
  document.body.style.width = savedBodyStyles.width ?? ''
  document.body.style.paddingRight = savedBodyStyles.paddingRight ?? ''
  window.scrollTo(0, savedScrollY)
  savedBodyStyles = null
}

/**
 * Sperrt den Seitenhintergrund, solange ein Dialog geöffnet ist.
 * Die Dialogkarte selbst bleibt normal scrollbar – auch auf iPhone/iPad.
 */
export function useModalScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lockPageScroll()
    return unlockPageScroll
  }, [active])
}

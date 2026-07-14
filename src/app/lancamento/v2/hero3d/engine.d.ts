export function mount(
  container: HTMLElement,
  scenes: any,
  opts?: { onReady?: () => void; onExplode?: () => void; light?: boolean },
): { goTo: (key: string) => boolean; attachAnchors?: (el: any) => void; dispose: () => void }

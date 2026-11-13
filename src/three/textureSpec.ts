/** Texture descriptions (no three.js dependency, so model code can use them). */
export type TextureKind = 'tile' | 'wood' | 'marble' | 'granite' | 'noise' | 'grass' | 'paving' | 'brick' | 'roofTile' | 'paint';

export interface TextureSpec {
  kind: TextureKind;
  /** Real-world size of one texture repeat (m). */
  tileM: number;
}

/** Texture for a floor finish id. */
export function finishTexture(finishId: string): TextureSpec {
  if (finishId.startsWith('wood')) return { kind: 'wood', tileM: 1.2 };
  if (finishId.startsWith('marble')) return { kind: 'marble', tileM: 1.2 };
  if (finishId.startsWith('granite')) return { kind: 'granite', tileM: 0.6 };
  if (finishId === 'kota_stone') return { kind: 'tile', tileM: 0.6 };
  if (finishId === 'concrete') return { kind: 'noise', tileM: 2 };
  if (finishId === 'athangudi_red' || finishId === 'terracotta') return { kind: 'tile', tileM: 0.3 };
  if (finishId === 'antiskid_blue') return { kind: 'tile', tileM: 0.3 };
  if (finishId.startsWith('ceramic')) return { kind: 'tile', tileM: 0.4 };
  return { kind: 'tile', tileM: 0.6 }; // vitrified 2'×2'
}


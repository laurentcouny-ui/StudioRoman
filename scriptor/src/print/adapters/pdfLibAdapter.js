export function layoutAstToPdfLibPlan(layoutAst) {
  // AUCUN calcul de mise en page ici : consommation stricte du Layout AST.
  return {
    label: 'exact-device-aligned',
    layoutContext: layoutAst?.layoutContext || null,
    pages: (layoutAst?.pages || []).map((page, i) => ({
      pageIndex: i,
      type: page.type,
      lines: (page.lines || []).map((line) => ({
        glyphRuns: line.glyphRuns || [],
      })),
    })),
  }
}

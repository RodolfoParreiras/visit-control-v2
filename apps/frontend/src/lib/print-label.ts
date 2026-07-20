/**
 * Imprime a etiqueta de visita usando um <iframe> oculto embutido na página.
 * Não requer permissão de pop-up — funciona dentro de iframes (como o preview do Replit).
 */
export function printVisitLabel(
  labelEl: HTMLElement,
  widthMm: number,
  heightMm: number,
): void {
  // Remove qualquer iframe anterior (proteção contra duplo clique)
  const old = document.getElementById('__print_frame__');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__print_frame__';
  iframe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  // Captura o HTML renderizado (com todos os estilos inline e o SVG do QR Code)
  const labelHtml = labelEl.innerHTML;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
    html, body {
      background: white;
      width: ${widthMm}mm;
      height: ${heightMm}mm;
    }
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
    }
    img { max-width: 100%; display: block; }
    svg { display: block; }
    /* Classes Tailwind usadas no PrintLabel */
    .bg-white  { background: white !important; }
    .text-black { color: black !important; }
    .border { border-width: 1px; border-style: solid; }
    .border-dashed { border-style: dashed; }
    .border-gray-300 { border-color: #d1d5db; }
  </style>
</head>
<body>
  ${labelHtml}
</body>
</html>`);
  doc.close();

  // Aguarda renderização (imagens / SVG) antes de imprimir
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // Remove o iframe após a caixa de diálogo de impressão fechar
        setTimeout(() => iframe.remove(), 2000);
      }
    }, 300);
  };
}

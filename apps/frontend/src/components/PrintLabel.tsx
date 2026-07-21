import React, { useMemo } from 'react';
import QRCode from 'react-qr-code';
import { formatDateOnly } from '@/lib/utils';
import type { Visit, LabelConfig } from '@visit-control/api-client';

interface PrintLabelProps {
  visit: Visit;
  config: LabelConfig;
}

export type ElementKey =
  | 'logo'
  | 'municipalityName'
  | 'title'
  | 'headerText'
  | 'visitorName'
  | 'sector'
  | 'date'
  | 'time'
  | 'qrCode'
  | 'visitNumber'
  | 'footerText';

export type ElementPosition = { x: number; y: number };
export type LabelLayout = Record<ElementKey, ElementPosition>;

export const DEFAULT_LAYOUT: LabelLayout = {
  logo:             { x: 2,  y: 4  },
  municipalityName: { x: 22, y: 5  },
  title:            { x: 22, y: 20 },
  headerText:       { x: 2,  y: 35 },
  visitorName:      { x: 2,  y: 38 },
  sector:           { x: 2,  y: 55 },
  date:             { x: 2,  y: 70 },
  time:             { x: 36, y: 70 },
  qrCode:           { x: 72, y: 25 },
  visitNumber:      { x: 72, y: 78 },
  footerText:       { x: 2,  y: 88 },
};

export function parseLayout(raw: string | null | undefined): LabelLayout {
  if (!raw) return DEFAULT_LAYOUT;
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function PrintLabel({ visit, config }: PrintLabelProps) {
  console.log("PRINT LABEL", visit);
  const layout = useMemo(() => parseLayout(config.elementsLayout), [config.elementsLayout]);

  const containerStyle: React.CSSProperties = {
    width:      `${config.labelWidth  ?? 100}mm`,
    height:     `${config.labelHeight ?? 60}mm`,
    fontSize:   `${config.fontSize    ?? 12}px`,
    fontFamily: config.fontFamily || 'Arial',
    position:   'relative',
    overflow:   'hidden',
    boxSizing:  'border-box',
  };

  const pos = (key: ElementKey): React.CSSProperties => ({
    position: 'absolute',
    left:     `${layout[key]?.x ?? 2}%`,
    top:      `${layout[key]?.y ?? 2}%`,
    maxWidth: '95%',
  });

  const entryDateStr = formatDateOnly(visit.entryDate) || '-';

  return (
    <div
      style={containerStyle}
      className="bg-white text-black border border-dashed border-gray-300 print:border-none"
    >
      {/* Logo */}
      {config.showLogo && config.logoUrl && (
        <div style={pos('logo')}>
          <img
            src={config.logoUrl}
            alt="Logo"
            style={{ height: '10mm', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* Nome do município */}
      {config.municipalityName && (
        <div
          style={{
            ...pos('municipalityName'),
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.72em',
            lineHeight: 1.2,
          }}
        >
          {config.municipalityName}
        </div>
      )}

      {/* Título */}
      {config.title && (
        <div
          style={{
            ...pos('title'),
            fontWeight: 'bold',
            fontSize: '0.68em',
            background: 'black',
            color: 'white',
            padding: '1px 5px',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {config.title}
        </div>
      )}

      {/* Subtítulo / header */}
      {config.headerText && (
        <div
          style={{
            ...pos('headerText'),
            fontSize: '0.62em',
            fontWeight: '500',
          }}
        >
          {config.headerText}
        </div>
      )}

      {/* Nome do visitante */}
      {config.showName && (
        <div style={pos('visitorName')}>
          <div style={{ fontSize: '0.58em', textTransform: 'uppercase', color: '#555', fontWeight: '600' }}>
            Visitante
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '0.9em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70mm' }}>
            {visit.visitor?.name || 'Não informado'}
          </div>
        </div>
      )}

      {/* Setor */}
      {config.showSector && (
        <div style={pos('sector')}>
          <div style={{ fontSize: '0.58em', textTransform: 'uppercase', color: '#555', fontWeight: '600' }}>
            Destino
          </div>
          <div style={{ fontWeight: '600', fontSize: '0.8em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55mm' }}>
            {visit.sector?.name || 'Não informado'}
          </div>
        </div>
      )}

      {/* Data */}
      {config.showDate && (
        <div style={pos('date')}>
          <div style={{ fontSize: '0.58em', textTransform: 'uppercase', color: '#555', fontWeight: '600' }}>
            Data
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{entryDateStr}</div>
        </div>
      )}

      {/* Hora */}
      {config.showTime && (
        <div style={pos('time')}>
          <div style={{ fontSize: '0.58em', textTransform: 'uppercase', color: '#555', fontWeight: '600' }}>
            Entrada
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{visit.entryTime || '-'}</div>
        </div>
      )}

      {/* QR Code */}
      {config.showQrCode && (
        <div style={{ ...pos('qrCode'), background: 'white', padding: '2px' }}>
          <QRCode 
            value={JSON.stringify({
              id: visit.id,
              visitante: visit.visitor?.name || 'Não informado',
              setor: visit.sector?.name || 'Não informado',
              data: entryDateStr,
              entrada: visit.entryTime || '-',
            })}
            size={46}
            level="L"
          />
        </div>
      )}

      {/* Número da visita */}
      {config.showVisitNumber && (
        <div
          style={{
            ...pos('visitNumber'),
            fontFamily: 'monospace',
            fontSize: '0.68em',
            fontWeight: 'bold',
          }}
        >
          #{String(visit.id).padStart(6, '0')}
        </div>
      )}

      {/* Rodapé */}
      {config.footerText && (
        <div
          style={{
            ...pos('footerText'),
            fontSize: '0.55em',
            color: '#555',
          }}
        >
          {config.footerText}
        </div>
      )}
    </div>
  );
}

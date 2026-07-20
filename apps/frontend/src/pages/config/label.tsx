import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useGetLabelConfig,
  useUpdateLabelConfig,
  getGetLabelConfigQueryKey,
} from '@visit-control/api-client';
import type { LabelConfig as ApiLabelConfig } from '@visit-control/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Tag, Save, Eye, Printer, Palette, LayoutGrid, List,
  RotateCcw, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, Controller } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PrintLabel, DEFAULT_LAYOUT, parseLayout } from '@/components/PrintLabel';
import type { ElementKey, LabelLayout } from '@/components/PrintLabel';

// ── Printer presets ──────────────────────────────────────────────────────────

const PRINTER_PRESETS: Array<{
  id: string;
  name: string;
  width: number | null;
  height: number | null;
}> = [
  { id: 'custom',          name: 'Personalizado',                   width: null, height: null },
  { id: 'zebra-57x32',     name: 'Zebra ZD220 / ZQ520 — 57×32 mm', width: 57,   height: 32   },
  { id: 'zebra-100x50',    name: 'Zebra ZD230 — 100×50 mm',        width: 100,  height: 50   },
  { id: 'zebra-102x25',    name: 'Zebra ZD410 — 102×25 mm',        width: 102,  height: 25   },
  { id: 'argox-57x30',     name: 'Argox OS-2140 — 57×30 mm',       width: 57,   height: 30   },
  { id: 'argox-100x50',    name: 'Argox CP-2140 — 100×50 mm',      width: 100,  height: 50   },
  { id: 'elgin-80x40',     name: 'Elgin i9 — 80×40 mm',            width: 80,   height: 40   },
  { id: 'elgin-100x50',    name: 'Elgin L42 — 100×50 mm',          width: 100,  height: 50   },
  { id: 'brother-62x29',   name: 'Brother TD-2130N — 62×29 mm',    width: 62,   height: 29   },
  { id: 'brother-102x51',  name: 'Brother TD-4550DNWB — 102×51 mm',width: 102,  height: 51   },
];

const FONT_FAMILIES = [
  { value: 'Arial',            label: 'Arial (padrão)'        },
  { value: 'Helvetica',        label: 'Helvetica'             },
  { value: 'Times New Roman',  label: 'Times New Roman'       },
  { value: 'Courier New',      label: 'Courier New (mono)'    },
  { value: 'Georgia',          label: 'Georgia'               },
  { value: 'Verdana',          label: 'Verdana'               },
  { value: 'Tahoma',           label: 'Tahoma'                },
];

// ── Editor element chips ─────────────────────────────────────────────────────

type ChipDef = {
  key: ElementKey;
  label: string;
  color: string;
  visibleWhen: (f: FormValues) => boolean;
};

const CHIPS: ChipDef[] = [
  { key: 'logo',             label: 'Logo',       color: 'bg-purple-100 border-purple-400 text-purple-800', visibleWhen: f => f.showLogo },
  { key: 'municipalityName', label: 'Município',  color: 'bg-blue-100 border-blue-400 text-blue-800',       visibleWhen: f => !!f.municipalityName },
  { key: 'title',            label: 'Título',     color: 'bg-indigo-100 border-indigo-400 text-indigo-800', visibleWhen: f => !!f.title },
  { key: 'headerText',       label: 'Subtítulo',  color: 'bg-cyan-100 border-cyan-400 text-cyan-800',       visibleWhen: f => !!f.headerText },
  { key: 'visitorName',      label: 'Nome',       color: 'bg-green-100 border-green-400 text-green-800',    visibleWhen: f => f.showName },
  { key: 'sector',           label: 'Setor',      color: 'bg-emerald-100 border-emerald-400 text-emerald-800', visibleWhen: f => f.showSector },
  { key: 'date',             label: 'Data',       color: 'bg-orange-100 border-orange-400 text-orange-800', visibleWhen: f => f.showDate },
  { key: 'time',             label: 'Hora',       color: 'bg-amber-100 border-amber-400 text-amber-800',    visibleWhen: f => f.showTime },
  { key: 'qrCode',           label: 'QR Code',    color: 'bg-gray-100 border-gray-400 text-gray-800',       visibleWhen: f => f.showQrCode },
  { key: 'visitNumber',      label: 'Nº Visita',  color: 'bg-slate-100 border-slate-400 text-slate-800',    visibleWhen: f => f.showVisitNumber },
  { key: 'footerText',       label: 'Rodapé',     color: 'bg-rose-100 border-rose-400 text-rose-800',       visibleWhen: f => !!f.footerText },
];

// ── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  municipalityName: z.string().optional().nullable(),
  title:            z.string().optional().nullable(),
  logoUrl:          z.string().optional().nullable(),
  showLogo:         z.boolean(),
  showQrCode:       z.boolean(),
  showName:         z.boolean(),
  showSector:       z.boolean(),
  showDate:         z.boolean(),
  showTime:         z.boolean(),
  showVisitNumber:  z.boolean(),
  labelWidth:       z.coerce.number().min(30).max(300),
  labelHeight:      z.coerce.number().min(20).max(300),
  marginTop:        z.coerce.number().min(0).max(30),
  marginRight:      z.coerce.number().min(0).max(30),
  marginBottom:     z.coerce.number().min(0).max(30),
  marginLeft:       z.coerce.number().min(0).max(30),
  fontSize:         z.coerce.number().min(6).max(32),
  fontFamily:       z.string(),
  printerModel:     z.string(),
  headerText:       z.string().optional().nullable(),
  footerText:       z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ── Mock visit for preview ────────────────────────────────────────────────────

const MOCK_VISIT: any = {
  id: 1234,
  visitor: { name: 'João Carlos Silva' },
  sector:  { name: 'Recursos Humanos'  },
  entryDate: new Date().toISOString(),
  entryTime: '09:15',
  status:    'ongoing',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConfigLabel() {
  const { data: config, isLoading } = useGetLabelConfig();
  const updateConfig = useUpdateLabelConfig();
  const queryClient  = useQueryClient();
  const { toast }    = useToast();

  // layout state (separate from react-hook-form)
  const [layout, setLayout] = useState<LabelLayout>(DEFAULT_LAYOUT);

  // drag state
  const [dragging, setDragging] = useState<ElementKey | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const editorRef     = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      municipalityName: 'Prefeitura Municipal de Paraíba do Sul',
      title:            'Identificação de Visitante',
      logoUrl:          '',
      showLogo:         false,
      showQrCode:       true,
      showName:         true,
      showSector:       true,
      showDate:         true,
      showTime:         true,
      showVisitNumber:  true,
      labelWidth:       100,
      labelHeight:      60,
      marginTop:        3,
      marginRight:      3,
      marginBottom:     3,
      marginLeft:       3,
      fontSize:         12,
      fontFamily:       'Arial',
      printerModel:     'custom',
      headerText:       '',
      footerText:       'Uso obrigatório nas dependências do prédio.',
    },
  });

  const currentValues = useWatch({ control: form.control }) as FormValues;

  // load saved config
  useEffect(() => {
    if (config) {
      form.reset({
        ...config,
        municipalityName: config.municipalityName || '',
        title:            config.title            || '',
        logoUrl:          config.logoUrl          || '',
        headerText:       config.headerText       || '',
        footerText:       config.footerText       || '',
        fontFamily:       config.fontFamily       || 'Arial',
        printerModel:     config.printerModel     || 'custom',
      });
      setLayout(parseLayout(config.elementsLayout));
    }
  }, [config, form]);

  // ── Drag-and-drop (window events) ────────────────────────────────────────

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      if (!editorRef.current) return;
      const rect = editorRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width)  * 100));
      const y = Math.max(0, Math.min(90, ((e.clientY - rect.top  - dragOffsetRef.current.y) / rect.height) * 100));
      setLayout(prev => ({ ...prev, [dragging]: { x, y } }));
    };

    const onUp = () => setDragging(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragging]);

  const handleChipMouseDown = useCallback((e: React.MouseEvent, key: ElementKey) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(key);
  }, []);

  // ── Printer preset ────────────────────────────────────────────────────────

  const applyPreset = (presetId: string) => {
    const preset = PRINTER_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    form.setValue('printerModel', presetId);
    if (preset.width  !== null) form.setValue('labelWidth',  preset.width);
    if (preset.height !== null) form.setValue('labelHeight', preset.height);
  };

  // ── Logo upload ───────────────────────────────────────────────────────────

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Logo muito grande', description: 'Máximo 2 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => form.setValue('logoUrl', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = (data: FormValues) => {
    updateConfig.mutate(
      { data: { ...data, elementsLayout: JSON.stringify(layout) } as ApiLabelConfig },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLabelConfigQueryKey() });
          toast({ title: '✓ Configuração da etiqueta salva com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao salvar configuração' }),
      }
    );
  };

  // ── Preview config (merged form values + layout) ──────────────────────────

  const previewConfig: ApiLabelConfig = {
    ...currentValues,
    elementsLayout: JSON.stringify(layout),
  } as ApiLabelConfig;

  // Editor canvas scale: render at 3.78 px/mm so the preview fits ~400px wide
  const editorWidth  = 420;
  const w = currentValues.labelWidth  || 100;
  const h = currentValues.labelHeight || 60;
  const editorHeight = Math.round((h / w) * editorWidth);

  const visibleChips = CHIPS.filter(c => c.visibleWhen(currentValues));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-screen-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Tag className="w-8 h-8 text-primary" />
              Configuração da Etiqueta
            </h1>
            <p className="text-gray-500 mt-1">
              Personalize o layout, dimensões e elementos da etiqueta de visitante.
            </p>
          </div>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateConfig.isPending}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Etiqueta
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12 text-muted-foreground">
            Carregando configurações…
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 2xl:grid-cols-[1fr_380px] gap-8 items-start">

                {/* ── Left panel: tabs ─────────────────────────────────────── */}
                <Tabs defaultValue="impressora" className="space-y-4">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="impressora" className="gap-1.5">
                      <Printer className="w-3.5 h-3.5" />
                      Impressora
                    </TabsTrigger>
                    <TabsTrigger value="aparencia" className="gap-1.5">
                      <Palette className="w-3.5 h-3.5" />
                      Aparência
                    </TabsTrigger>
                    <TabsTrigger value="elementos" className="gap-1.5">
                      <List className="w-3.5 h-3.5" />
                      Elementos
                    </TabsTrigger>
                    <TabsTrigger value="editor" className="gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Editor Visual
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Tab: Impressora ──────────────────────────────────── */}
                  <TabsContent value="impressora">
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle className="text-base">Modelo de Impressora e Dimensões</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">

                        {/* Preset selector */}
                        <div className="space-y-2">
                          <Label>Modelo / Preset</Label>
                          <Controller
                            control={form.control}
                            name="printerModel"
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={v => { field.onChange(v); applyPreset(v); }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a impressora…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRINTER_PRESETS.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {currentValues.printerModel !== 'custom' && (
                            <p className="text-xs text-muted-foreground">
                              Dimensões aplicadas automaticamente. Você pode ajustá-las manualmente abaixo.
                            </p>
                          )}
                        </div>

                        {/* Dimensions */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="labelWidth" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Largura (mm)</FormLabel>
                              <FormControl>
                                <Input type="number" min={30} max={300} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="labelHeight" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Altura (mm)</FormLabel>
                              <FormControl>
                                <Input type="number" min={20} max={300} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        {/* Margins */}
                        <div>
                          <Label className="mb-3 block">Margens (mm)</Label>
                          <div className="grid grid-cols-4 gap-3">
                            {(
                              [
                                ['marginTop',    'Superior'],
                                ['marginRight',  'Direita' ],
                                ['marginBottom', 'Inferior'],
                                ['marginLeft',   'Esquerda'],
                              ] as const
                            ).map(([name, label]) => (
                              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">{label}</FormLabel>
                                  <FormControl>
                                    <Input type="number" min={0} max={30} step={0.5} {...field} />
                                  </FormControl>
                                </FormItem>
                              )} />
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Tab: Aparência ───────────────────────────────────── */}
                  <TabsContent value="aparencia">
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle className="text-base">Textos, Fontes e Logo</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">

                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="municipalityName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Município</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Título da Etiqueta</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>

                        <FormField control={form.control} name="headerText" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subtítulo (abaixo do título)</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="ex: Secretaria Municipal de Administração" />
                            </FormControl>
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="footerText" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Texto de Rodapé</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="ex: Uso obrigatório nas dependências do prédio." />
                            </FormControl>
                          </FormItem>
                        )} />

                        {/* Font */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Família de Fonte</Label>
                            <Controller
                              control={form.control}
                              name="fontFamily"
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FONT_FAMILIES.map(f => (
                                      <SelectItem key={f.value} value={f.value}>
                                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                          <FormField control={form.control} name="fontSize" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tamanho da fonte base: {field.value}px</FormLabel>
                              <FormControl>
                                <Slider
                                  min={6} max={24} step={1}
                                  value={[Number(field.value)]}
                                  onValueChange={([v]) => field.onChange(v)}
                                  className="mt-3"
                                />
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>

                        {/* Logo */}
                        <div className="space-y-3 border rounded-lg p-4 bg-gray-50/50">
                          <Label className="text-sm font-semibold">Logo da Prefeitura</Label>
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Enviar imagem
                            </Button>
                            <span className="text-xs text-muted-foreground">PNG, JPG ou SVG · máx. 2 MB</span>
                            {currentValues.logoUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => form.setValue('logoUrl', '')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                          {currentValues.logoUrl && (
                            <div className="flex items-center gap-3 p-2 border rounded bg-white">
                              <img
                                src={currentValues.logoUrl}
                                alt="Logo atual"
                                className="h-10 object-contain"
                              />
                              <span className="text-xs text-muted-foreground">Logo carregada</span>
                            </div>
                          )}
                          <FormField control={form.control} name="logoUrl" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Ou cole uma URL</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ''} placeholder="https://…" className="text-xs" />
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Tab: Elementos ───────────────────────────────────── */}
                  <TabsContent value="elementos">
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle className="text-base">Campos Exibidos na Etiqueta</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {([
                            ['showLogo',        'Logo da Prefeitura'  ],
                            ['showQrCode',      'QR Code'             ],
                            ['showName',        'Nome do Visitante'   ],
                            ['showSector',      'Setor de Destino'    ],
                            ['showDate',        'Data de Entrada'     ],
                            ['showTime',        'Hora de Entrada'     ],
                            ['showVisitNumber', 'Número da Visita'    ],
                          ] as const).map(([name, label]) => (
                            <FormField key={name} control={form.control} name={name} render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-white">
                                <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value as boolean}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )} />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Tab: Editor Visual ───────────────────────────────── */}
                  <TabsContent value="editor">
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Posicionamento dos Elementos</CardTitle>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setLayout(DEFAULT_LAYOUT)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resetar Layout
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Arraste os elementos (chips coloridos) para reposicioná-los na etiqueta.
                          Apenas elementos <strong>habilitados</strong> aparecem aqui.
                        </p>

                        {/* Editor canvas */}
                        <div className="flex justify-center">
                          <div
                            ref={editorRef}
                            className="relative bg-white border-2 border-dashed border-gray-400 rounded shadow-inner select-none"
                            style={{ width: editorWidth, height: editorHeight }}
                          >
                            {/* Grid overlay */}
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                                backgroundSize: '10% 10%',
                              }}
                            />

                            {/* Draggable element chips */}
                            {visibleChips.map(chip => (
                              <div
                                key={chip.key}
                                className={`absolute px-2 py-1 rounded border text-[11px] font-semibold cursor-grab active:cursor-grabbing select-none shadow-sm transition-shadow ${chip.color} ${dragging === chip.key ? 'shadow-md scale-105 z-10' : ''}`}
                                style={{
                                  left:      `${layout[chip.key]?.x ?? 2}%`,
                                  top:       `${layout[chip.key]?.y ?? 2}%`,
                                  transform: dragging === chip.key ? 'scale(1.05)' : undefined,
                                }}
                                onMouseDown={e => handleChipMouseDown(e, chip.key)}
                              >
                                {chip.label}
                              </div>
                            ))}

                            {visibleChips.length === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                                Nenhum elemento visível. Habilite campos na aba Elementos.
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-center text-muted-foreground">
                          Escala proporcional · {w}×{h} mm
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* ── Right panel: live preview ─────────────────────────── */}
                <div className="sticky top-6 space-y-3">
                  <Card className="bg-gray-100/60">
                    <CardHeader className="border-b border-gray-200 py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        Prévia em Tempo Real
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex items-center justify-center min-h-[200px] overflow-auto">
                      <div className="shadow-2xl">
                        <div
                          style={{
                            // scale to fit preview panel (max 340px wide)
                            transform: `scale(${Math.min(1, 340 / ((currentValues.labelWidth || 100) * 3.78))})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          <PrintLabel visit={MOCK_VISIT} config={previewConfig} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <p className="text-xs text-center text-muted-foreground">
                    Dados de exemplo · {w}×{h} mm
                  </p>

                  <Button
                    type="submit"
                    disabled={updateConfig.isPending}
                    className="w-full gap-2"
                    onClick={form.handleSubmit(onSubmit)}
                  >
                    <Save className="w-4 h-4" />
                    Salvar Configurações
                  </Button>
                </div>

              </div>
            </form>
          </Form>
        )}
      </div>
    </AppLayout>
  );
}

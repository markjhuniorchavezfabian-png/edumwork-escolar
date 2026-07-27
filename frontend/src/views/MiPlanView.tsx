import { useState } from "react";
import { ExternalLink, Cpu, HardDrive, MemoryStick, Zap, CheckCircle2, ChevronRight, MessageCircle, Package } from "lucide-react";
import { cn } from "../lib/utils";

const WHATSAPP = "51988783411";

interface VPS {
  proveedor: string; bandera: string; ram_gb: number; cpu: number;
  disco_gb: number; precio_ref: string; factura_ruc: boolean;
  url: string; recomendado?: boolean; nota?: string; combo_dominio?: boolean;
}

const VPS_LIST: VPS[] = [
  {
    proveedor: "SitioHost (Perú)", bandera: "🇵🇪", ram_gb: 4, cpu: 2, disco_gb: 60,
    precio_ref: "~S/ 90", factura_ruc: true, url: "https://sitiohost.pe",
    recomendado: true, combo_dominio: true,
    nota: "Pago en soles, factura con RUC, soporte en español. Incluye dominio .com.pe gratis el primer año en algunos planes.",
  },
  {
    proveedor: "HostPerú", bandera: "🇵🇪", ram_gb: 2, cpu: 1, disco_gb: 40,
    precio_ref: "~S/ 55", factura_ruc: true, url: "https://hostperu.com.pe",
    combo_dominio: true,
    nota: "Opción económica con RUC. Suele incluir dominio .pe gratis con planes anuales.",
  },
  {
    proveedor: "DigitalOcean", bandera: "🇺🇸", ram_gb: 4, cpu: 2, disco_gb: 80,
    precio_ref: "~$12 USD", factura_ruc: false, url: "https://digitalocean.com",
    nota: "Muy confiable y fácil de usar. Requiere tarjeta de crédito en USD. Suele dar $200 de crédito gratis para cuentas nuevas.",
  },
  {
    proveedor: "Hetzner Cloud", bandera: "🇩🇪", ram_gb: 4, cpu: 2, disco_gb: 40,
    precio_ref: "~€4", factura_ruc: false, url: "https://www.hetzner.com/cloud/",
    nota: "El más barato. Servidores en Alemania o Finlandia. Panel en inglés, pago con tarjeta.",
  },
];

interface Dominio { tipo: string; ejemplo: string; precio: string; nota: string; url: string; }

const DOMINIOS: Dominio[] = [
  { tipo: ".edu.pe", ejemplo: "tucolegio.edu.pe", precio: "~S/ 90/año",
    nota: "Oficial MINEDU. Requiere código modular del colegio ante NIC Perú.", url: "https://nic.pe" },
  { tipo: ".com.pe", ejemplo: "tucolegio.com.pe", precio: "~S/ 45/año",
    nota: "Más fácil de conseguir. Se tramita en NIC Perú.", url: "https://nic.pe" },
  { tipo: ".com", ejemplo: "tucolegio.com", precio: "~S/ 40/año",
    nota: "Más rápido de registrar. Válido para cualquier colegio.", url: "https://cloudflare.com/products/registrar/" },
];

function StepHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export default function MiPlanView() {
  const [sugerencia, setSugerencia] = useState("");

  function enviarSugerencia() {
    if (!sugerencia.trim()) return;
    const texto = encodeURIComponent(
      `💡 Sugerencia para EduMWork:\n\n${sugerencia.trim()}`
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${texto}`, "_blank");
    setSugerencia("");
  }

  return (
    <div className="max-w-3xl space-y-8">

      {/* ENCABEZADO */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">¿Cuánto cuesta tener EduMWork?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu colegio controla su propia infraestructura — pagas directamente a cada proveedor y los datos son tuyos.
        </p>
      </div>

      {/* RESUMEN */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
        <div className="text-sm font-semibold">Resumen de costos típicos</div>
        <div className="space-y-2 text-sm">
          {[
            { label: "Licencia EduMWork", detalle: "pago único de instalación", valor: "S/ 350–550" },
            { label: "Servidor (VPS)", detalle: "lo contratas directamente — ver opciones abajo", valor: "S/ 40–90/mes" },
            { label: "Dominio", detalle: "lo registras directamente (o incluido con el servidor)", valor: "S/ 40–90/año" },
            { label: "IA (opcional)", detalle: "DeepSeek o similar — solo para informes automáticos", valor: "S/ 5–30/mes" },
          ].map(({ label, detalle, valor }) => (
            <div key={label} className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground"> — {detalle}</span>
              </div>
              <span className="text-xs font-semibold shrink-0">{valor}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground border-t border-primary/20 pt-3">
          Otros sistemas cobran S/ 400–760/mes con tus datos en servidores de terceros.
          Con EduMWork, los datos son <strong>tuyos</strong> en tu propio servidor.
        </p>
      </div>

      {/* PASO 1: LICENCIA */}
      <section>
        <StepHeader
          n={1}
          title="Licencia EduMWork"
          sub="Pago único para instalar y configurar el sistema en tu servidor."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              plan: "Pequeño", alumnos: "Hasta 500 alumnos", setup: "S/ 350",
              items: ["Instalación en tu servidor", "Personalización (logo, nombre, datos)", "Migración desde Excel (hasta 500 fichas)", "Capacitación 2 h al equipo directivo"],
            },
            {
              plan: "Grande", alumnos: "Más de 500 alumnos", setup: "S/ 550", destacado: true,
              items: ["Todo lo del plan Pequeño", "Migración extendida (más de 500 fichas)", "Configuración avanzada por módulos", "Capacitación 3 h + sesión de seguimiento"],
            },
          ].map(({ plan, alumnos, setup, destacado, items }) => (
            <div
              key={plan}
              className={cn(
                "rounded-xl border p-4 space-y-3",
                destacado ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{plan}</span>
                  {destacado && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Mayor complejidad
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{alumnos}</div>
              </div>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <ChevronRight size={11} className="text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pago único</span>
                <span className="text-lg font-bold text-primary">{setup}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actualizaciones */}
        <div className="mt-3 rounded-xl border border-border/60 bg-card p-4 flex items-start gap-3">
          <Package size={15} className="text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              Actualizaciones del sistema
              <a href="/versiones" className="text-[10px] font-normal text-primary hover:underline">
                Ver versiones disponibles →
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Cuando hay una nueva versión disponible, aparece una notificación en el sistema con el detalle
              de novedades y el precio. No son obligatorias — el sistema sigue funcionando sin actualizar.
              Puedes elegir cuándo y qué versión instalar.
            </p>
          </div>
        </div>
      </section>

      {/* PASO 2: SERVIDOR */}
      <section>
        <StepHeader
          n={2}
          title="Servidor (VPS)"
          sub="Lo contratas directamente tú. EduMWork funciona en cualquier servidor Linux con Docker instalado."
        />

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Cpu, label: "CPU", val: "2 vCPU mín." },
            { icon: MemoryStick, label: "RAM", val: "4 GB mín." },
            { icon: HardDrive, label: "Disco", val: "60 GB SSD" },
          ].map(({ icon: Icon, label, val }) => (
            <div key={label} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
              <Icon size={16} className="mx-auto text-primary mb-1" />
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold">{val}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          {VPS_LIST.map((v) => (
            <a
              key={v.proveedor}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-4 rounded-xl border bg-card p-4 hover:shadow-sm transition-all group",
                v.recomendado ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-primary/30"
              )}
            >
              <span className="text-3xl">{v.bandera}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{v.proveedor}</span>
                  {v.recomendado && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Recomendado
                    </span>
                  )}
                  {v.factura_ruc && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      Factura RUC
                    </span>
                  )}
                  {v.combo_dominio && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                      Combo con dominio
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {v.cpu} vCPU · {v.ram_gb} GB RAM · {v.disco_gb} GB SSD
                </div>
                {v.nota && <div className="text-[11px] text-muted-foreground italic mt-0.5">{v.nota}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold">{v.precio_ref}</div>
                <div className="text-[10px] text-muted-foreground">/mes*</div>
                <ExternalLink size={12} className="ml-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </a>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          * Precio referencial — verifica el precio actual en el sitio del proveedor antes de contratar.
          EduMWork funciona en cualquier VPS Linux con Docker, no solo los listados aquí.
        </p>
      </section>

      {/* PASO 3: DOMINIO */}
      <section>
        <StepHeader
          n={3}
          title="Dominio"
          sub="Para que docentes y padres entren por una dirección web propia. Muchos servidores lo incluyen gratis el primer año."
        />
        <div className="grid gap-2">
          {DOMINIOS.map((d) => (
            <a
              key={d.tipo}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{d.tipo}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ej: <code className="text-primary">{d.ejemplo}</code>
                </div>
                <div className="text-[11px] text-muted-foreground italic mt-0.5">{d.nota}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">{d.precio}</div>
                <ExternalLink size={12} className="ml-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </a>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          SitioHost y HostPerú incluyen dominio gratis con planes anuales — consulta al contratar.
        </p>
      </section>

      {/* PASO 4: IA */}
      <section>
        <StepHeader n={4} title="IA (opcional)" sub="Solo si quieres usar informes automáticos, análisis de incidencias y alertas." />
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Zap size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">Usas tu propia clave de IA</span> — los datos del colegio nunca
              salen a servidores de terceros. Se configura en{" "}
              <a href="/config-ia" className="text-primary hover:underline">Administración → Configurar IA</a>.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            {[
              { nombre: "DeepSeek", precio: "~S/ 5–15/mes", nota: "Recomendado. Muy económico, alta calidad en español." },
              { nombre: "OpenAI GPT-4o", precio: "~S/ 30–80/mes", nota: "El más potente, pero más caro." },
              { nombre: "Ollama (local)", precio: "S/ 0/mes", nota: "Gratis si el servidor tiene GPU. Sin internet." },
            ].map(({ nombre, precio, nota }) => (
              <div key={nombre} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                <div className="font-semibold">{nombre}</div>
                <div className="text-primary font-bold">{precio}</div>
                <div className="text-muted-foreground">{nota}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Los costos reales de uso aparecen en{" "}
            <a href="/costos-ia" className="text-primary hover:underline">Administración → Costos de IA</a>.
          </p>
        </div>
      </section>

      {/* SUGERENCIAS */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          <span className="text-sm font-semibold">¿Tienes una sugerencia para el sistema?</span>
        </div>
        <p className="text-xs text-muted-foreground">
          ¿Algo que te gustaría mejorar, una función que falta, o algo confuso? Escríbelo y nos llega directamente.
        </p>
        <textarea
          value={sugerencia}
          onChange={(e) => setSugerencia(e.target.value)}
          placeholder="Ej: sería útil poder exportar la asistencia por semana..."
          rows={3}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={enviarSugerencia}
          disabled={!sugerencia.trim()}
          className="flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          <MessageCircle size={15} />
          Enviar sugerencia por WhatsApp
        </button>
      </section>

    </div>
  );
}

export type EventType = "reunion" | "evento" | "cita" | "otro";
export type Priority = "baja" | "media" | "alta";

export interface AgendaEvent {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  attendees: string | null;
  description: string | null;
  notes: string | null;
  google_event_id: string | null;
  reminder_minutes: number | null;
}

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Predeterminado de Google" },
  { value: "-1", label: "Sin aviso" },
  { value: "0", label: "A la hora del evento" },
  { value: "5", label: "5 minutos antes" },
  { value: "10", label: "10 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 día antes" },
  { value: "2880", label: "2 días antes" },
  { value: "10080", label: "1 semana antes" },
];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  status: "pendiente" | "en_curso" | "hecha";
  completed_at: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  updated_at: string;
}

export interface Transaction {
  id: string;
  kind: "gasto" | "ingreso" | "ahorro";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  payment_method: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  estimated_price: number | null;
  priority: Priority;
  url: string | null;
  notes: string | null;
  status: "pendiente" | "comprado" | "descartado";
  purchased_at: string | null;
}

export const EVENT_TYPES: Record<EventType, { label: string; color: string }> = {
  reunion: { label: "Reunión", color: "bg-blue-100 text-blue-800" },
  evento: { label: "Evento", color: "bg-violet-100 text-violet-800" },
  cita: { label: "Cita", color: "bg-amber-100 text-amber-800" },
  otro: { label: "Otro", color: "bg-slate-100 text-slate-700" },
};

export const PRIORITIES: Record<Priority, { label: string; color: string; order: number }> = {
  alta: { label: "Alta", color: "bg-red-100 text-red-700", order: 0 },
  media: { label: "Media", color: "bg-amber-100 text-amber-700", order: 1 },
  baja: { label: "Baja", color: "bg-slate-100 text-slate-600", order: 2 },
};

export const EXPENSE_CATEGORIES = [
  "Comida", "Supermercado", "Restaurantes", "Transporte", "Vivienda", "Facturas",
  "Ocio", "Salud", "Ropa", "Tecnología", "Suscripciones", "Regalos", "Formación", "Compras", "Otros",
];
export const INCOME_CATEGORIES = ["Nómina", "Freelance", "Ventas", "Regalos", "Intereses", "Otros"];
export const SAVINGS_CATEGORIES = ["Ahorro común", "Inversión", "Fondo de emergencia"];

export const KINDS = {
  gasto: { label: "Gasto", plural: "Gastos", sign: "−", color: "text-red-600" },
  ingreso: { label: "Ingreso", plural: "Ingresos", sign: "+", color: "text-emerald-600" },
  ahorro: { label: "Ahorro", plural: "Ahorro", sign: "→", color: "text-sky-600" },
} as const;

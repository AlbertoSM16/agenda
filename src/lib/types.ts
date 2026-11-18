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
}

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
  kind: "gasto" | "ingreso";
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

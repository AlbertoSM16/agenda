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

// ---------- Entrenamientos ----------

export type Sport = "bici" | "carrera" | "gimnasio" | "natacion" | "otro";

export const SPORTS: Record<Sport, { label: string; icon: string; badge: string; bar: string }> = {
  bici: { label: "Bici", icon: "🚴", badge: "bg-orange-100 text-orange-800", bar: "bg-orange-400" },
  carrera: { label: "Carrera", icon: "🏃", badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  gimnasio: { label: "Gimnasio", icon: "🏋️", badge: "bg-violet-100 text-violet-800", bar: "bg-violet-500" },
  natacion: { label: "Natación", icon: "🏊", badge: "bg-sky-100 text-sky-800", bar: "bg-sky-500" },
  otro: { label: "Otro", icon: "⚡", badge: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
};

export const isSport = (s: string | undefined | null): s is Sport => !!s && s in SPORTS;

export interface Lap {
  distance_m: number | null;
  duration_s: number | null;
  avg_hr: number | null;
  avg_speed_mps: number | null;
  avg_power: number | null;
  elevation_gain_m: number | null;
}

export interface Workout {
  id: string;
  garmin_activity_id: number | null;
  source: "garmin" | "manual";
  sport: Sport;
  garmin_type: string | null;
  title: string;
  started_at: string;
  duration_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  calories: number | null;
  avg_power: number | null;
  norm_power: number | null;
  avg_cadence: number | null;
  pool_length_m: number | null;
  avg_swolf: number | null;
  strokes: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
  training_load: number | null;
  vo2max: number | null;
  laps: Lap[] | null;
  rpe: number | null;
  notes: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  garmin_key: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  duration_s: number | null;
  is_warmup: boolean;
  source: "garmin" | "manual";
}

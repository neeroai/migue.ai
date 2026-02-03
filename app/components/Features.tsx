'use client'

import {
  Calendar,
  Mic,
  FileText,
  Bell,
  CheckSquare,
  Video,
  Image,
  Clock
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Gestión de Citas',
    description: 'Agenda automáticamente tus reuniones, envía confirmaciones y recupera citas canceladas. Todo sin salir de WhatsApp.',
    color: 'text-accent-purple-500',
    bgColor: 'bg-accent-purple-100',
  },
  {
    icon: Mic,
    title: 'Transcripción de Audios',
    description: 'Envía un audio de WhatsApp y recíbelo transcrito al instante. Perfecto cuando no puedes escuchar en voz alta.',
    color: 'text-accent-blue-500',
    bgColor: 'bg-accent-blue-100',
  },
  {
    icon: FileText,
    title: 'Análisis de Documentos',
    description: 'Sube un PDF y hazle preguntas. Obtén resúmenes, extrae información clave y ahorra horas de lectura.',
    color: 'text-accent-green-500',
    bgColor: 'bg-accent-green-100',
  },
  {
    icon: Bell,
    title: 'Recordatorios Inteligentes',
    description: 'Nunca olvides una tarea importante. Programa recordatorios y recíbelos exactamente cuando los necesites.',
    color: 'text-accent-orange-500',
    bgColor: 'bg-accent-orange-100',
  },
  {
    icon: CheckSquare,
    title: 'Gestión de Tareas',
    description: 'Crea, organiza y da seguimiento a tus pendientes de forma conversacional. Como hablar con tu asistente personal.',
    color: 'text-primary-500',
    bgColor: 'bg-primary-100',
  },
  {
    icon: Video,
    title: 'Resúmenes de Videos',
    description: 'Envía un link de YouTube y recibe un resumen completo en segundos. Ahorra tiempo viendo solo lo importante.',
    color: 'text-secondary-500',
    bgColor: 'bg-secondary-100',
  },
  {
    icon: Image,
    title: 'Análisis de Imágenes',
    description: 'Envía fotos de productos, menús o documentos. migue.ai los identifica y te da toda la información que necesitas.',
    color: 'text-accent-purple-600',
    bgColor: 'bg-accent-purple-100',
  },
  {
    icon: Clock,
    title: 'Mensajes Programados',
    description: 'Programa mensajes de WhatsApp para enviarlos en el momento perfecto. Nunca olvides un cumpleaños o recordatorio.',
    color: 'text-accent-blue-600',
    bgColor: 'bg-accent-blue-100',
  },
];

export function Features(): React.JSX.Element {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Todo lo que necesitas,
            <br />
            <span className="text-primary-600">en un solo lugar</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            migue.ai es como tener un asistente personal que nunca duerme y siempre
            está listo para ayudarte con tus tareas diarias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-slate-200"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bgColor} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
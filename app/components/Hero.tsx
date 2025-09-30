import { MessageCircle, Sparkles } from 'lucide-react';
import { CTA } from './CTA';

export function Hero(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden bg-gradient-primary py-20 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-accent-orange-400" />
            <span className="text-sm font-medium text-white">
              Más de 1,000 usuarios ya están ahorrando tiempo
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 animate-slide-down text-balance">
            Tu Asistente Personal de IA,
            <br />
            <span className="text-accent-orange-400">Directo en WhatsApp</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-3xl mx-auto animate-slide-up text-balance">
            Ahorra más de 5 horas a la semana. Gestiona citas, transcribe audios,
            analiza documentos y nunca olvides una tarea importante. Todo sin salir
            de WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in">
            <CTA variant="secondary" size="large">
              <MessageCircle className="w-5 h-5" />
              Comenzar Gratis
            </CTA>
            <button className="px-8 py-4 text-white font-semibold hover:text-accent-orange-400 transition-colors">
              Ver cómo funciona →
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Sin tarjeta de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Cancela cuando quieras</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Responde en segundos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 to-transparent"></div>
    </section>
  );
}
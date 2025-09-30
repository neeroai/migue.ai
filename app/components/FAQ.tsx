'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: '¿Qué es migue.ai?',
    answer: 'migue.ai es tu asistente personal de inteligencia artificial que funciona directamente en WhatsApp. Te ayuda con tareas como gestionar citas, transcribir audios, analizar documentos, crear recordatorios y mucho más. Todo sin necesidad de instalar ninguna aplicación adicional.',
  },
  {
    question: '¿Cómo empiezo a usar migue.ai?',
    answer: 'Es muy simple: guarda nuestro número de WhatsApp en tus contactos y envía tu primer mensaje. Puedes empezar con algo como "Hola" o "Ayúdame a organizar mi día". migue.ai te responderá de inmediato y te guiará en todo el proceso.',
  },
  {
    question: '¿Es realmente gratis?',
    answer: 'Sí. Ofrecemos un plan gratuito con límites generosos que incluye las funcionalidades básicas. Para usuarios que necesitan más capacidad, tenemos planes premium desde $9/mes con límites más altos y funciones avanzadas.',
  },
  {
    question: '¿Qué tan rápido responde migue.ai?',
    answer: 'migue.ai responde en 1-2 segundos promedio. Es más rápido que escribir un mensaje manualmente. Nuestros servidores están optimizados para darte respuestas instantáneas sin importar la hora del día.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Absolutamente. Usamos encriptación de extremo a extremo y cumplimos con las normativas internacionales de protección de datos. Tus conversaciones y archivos nunca se comparten con terceros y puedes eliminar tu información en cualquier momento.',
  },
  {
    question: '¿Funciona en español?',
    answer: 'Sí, migue.ai está diseñado específicamente para el mercado latinoamericano. Habla español con fluidez y entiende modismos regionales. Nuestro equipo de soporte también es latino y está disponible en español.',
  },
  {
    question: '¿Puedo cancelar en cualquier momento?',
    answer: 'Por supuesto. No hay contratos ni compromisos a largo plazo. Puedes cancelar tu suscripción en cualquier momento directamente desde WhatsApp o contactando a soporte. Si cancelas, mantienes acceso hasta el final de tu período de facturación.',
  },
  {
    question: '¿Qué tipos de archivos puedo enviar?',
    answer: 'Puedes enviar audios de WhatsApp (transcripción), PDFs (análisis y resumen), imágenes (identificación y análisis), y links de YouTube (resúmenes de video). Estamos trabajando en agregar más formatos próximamente.',
  },
];

export function FAQ(): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Preguntas
            <br />
            <span className="text-primary-600">Frecuentes</span>
          </h2>
          <p className="text-lg text-slate-600">
            Todo lo que necesitas saber sobre migue.ai
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-lg transition-all"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-lg">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-6 h-6 text-primary-600 flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 text-slate-600 leading-relaxed animate-slide-down">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center p-8 bg-slate-50 rounded-2xl">
          <p className="text-slate-600 mb-4">
            ¿Tienes más preguntas? Estamos aquí para ayudarte.
          </p>
          <button className="px-6 py-3 bg-gradient-primary text-white font-semibold rounded-lg hover:shadow-lg transition-all hover:scale-105">
            Contactar Soporte
          </button>
        </div>
      </div>
    </section>
  );
}
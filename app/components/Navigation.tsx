'use client';

import { useState } from 'react';
import { MessageCircle, Menu, X } from 'lucide-react';

export function Navigation(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">migue.ai</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-700 hover:text-primary-600 transition-colors font-medium">
              Funcionalidades
            </a>
            <a href="#how-it-works" className="text-slate-700 hover:text-primary-600 transition-colors font-medium">
              Cómo Funciona
            </a>
            <a href="#use-cases" className="text-slate-700 hover:text-primary-600 transition-colors font-medium">
              Casos de Uso
            </a>
            <a href="#faq" className="text-slate-700 hover:text-primary-600 transition-colors font-medium">
              FAQ
            </a>
            <button className="px-6 py-2 bg-gradient-primary text-white font-semibold rounded-lg hover:shadow-lg transition-all hover:scale-105">
              Comenzar Gratis
            </button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 animate-slide-down">
          <div className="px-4 py-4 space-y-4">
            <a
              href="#features"
              className="block text-slate-700 hover:text-primary-600 transition-colors font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Funcionalidades
            </a>
            <a
              href="#how-it-works"
              className="block text-slate-700 hover:text-primary-600 transition-colors font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Cómo Funciona
            </a>
            <a
              href="#use-cases"
              className="block text-slate-700 hover:text-primary-600 transition-colors font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Casos de Uso
            </a>
            <a
              href="#faq"
              className="block text-slate-700 hover:text-primary-600 transition-colors font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              FAQ
            </a>
            <button className="w-full px-6 py-3 bg-gradient-primary text-white font-semibold rounded-lg hover:shadow-lg transition-all">
              Comenzar Gratis
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
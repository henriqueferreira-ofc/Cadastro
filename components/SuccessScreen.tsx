
import React from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';

interface SuccessScreenProps {
  onRestart: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ onRestart }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-in zoom-in duration-500">
      <div className="flex justify-center mb-6">
        <div className="bg-green-100 p-4 rounded-full">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>
      </div>
      
      <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Cadastro Concluído!</h2>
      <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
        Sua atualização cadastral foi recebida com sucesso. Suas informações agora estão seguras e atualizadas em nosso sistema oficial.
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
        <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-tight">O que acontece agora?</h4>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li>Seu CPF foi marcado como "Atualizado".</li>
          <li>Os dados serão revisados pela administração.</li>
          <li>Não é necessário realizar este processo novamente.</li>
        </ul>
      </div>

      <button
        onClick={onRestart}
        className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-bold transition-all group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Sair do Sistema</span>
      </button>
    </div>
  );
};

export default SuccessScreen;

import React from 'react';
import CommunicationsManager from './CommunicationsManager';

export default function CommunicationsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Comunicação</h2>
        <p className="mt-1 text-sm text-gray-500">
          Publique trabalhos realizados, atividades em andamento, resultados e avisos da AAFAB.
        </p>
      </div>
      <CommunicationsManager defaultExpanded />
    </div>
  );
}

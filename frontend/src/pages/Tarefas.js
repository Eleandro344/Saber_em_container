import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../styles/tarefas.css';

const etapas = [
  'PROJETO NA FILA',
  'EM NEGOCIAÇÃO',
  'EXECUÇÃO DO TIME',
  'APRESENTAÇÃO AO CLIENTE',
  'VALORES',
  'ENTREGA AO CLIENTE'
];

const Tarefas = () => {
  const [quadros, setQuadros] = useState([]);
  const token = localStorage.getItem('access');

  useEffect(() => {
    fetch('http://localhost:8000/api/quadros/', {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setQuadros(data);
      });
  }, [token]);

  const calcularStatus = (dataCriacao) => {
    const data = new Date(dataCriacao);
    const dataLimite = new Date(data);
    dataLimite.setDate(dataLimite.getDate() + 3);
    const hoje = new Date();

    const status = hoje <= dataLimite ? 'Em dia' : 'Atrasado';
    const previsao = dataLimite.toLocaleDateString();
    return { status, previsao };
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const movedQuadro = quadros.find(q => q.id.toString() === draggableId);
    if (!movedQuadro) return;

    const origemIdx = etapas.indexOf(source.droppableId);
    const destinoIdx = etapas.indexOf(destination.droppableId);
    const diff = destinoIdx - origemIdx;

    const novaDataCriacao = new Date(movedQuadro.criado_em);
    novaDataCriacao.setDate(novaDataCriacao.getDate() + diff * 3);

    const updatedQuadros = quadros.map(quadro =>
      quadro.id.toString() === draggableId
        ? {
            ...quadro,
            situacao: destination.droppableId,
            criado_em: novaDataCriacao.toISOString()
          }
        : quadro
    );
    setQuadros(updatedQuadros);

    fetch(`http://localhost:8000/api/quadros/${draggableId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        situacao: destination.droppableId,
        criado_em: novaDataCriacao.toISOString(),
      }),
    });
  };

  return (
    <div className="kanban-page">
      <div className="kanban-title-wrapper">
        <h3 className="kanban-title">Quadros por Etapas</h3>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-container">
          {etapas.map((etapa, idx) => (
            <div key={idx} className="kanban-col">
              <div className="kanban-header">{etapa}</div>
              <Droppable droppableId={etapa}>
                {(provided) => (
                  <div
                    className="kanban-cards"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {quadros
                      .filter(quadro => quadro.situacao === etapa)
                      .map((quadro, index) => {
                        const { status, previsao } = calcularStatus(quadro.criado_em);
                        return (
                          <Draggable
                            key={quadro.id}
                            draggableId={quadro.id.toString()}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                className="kanban-card"
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <strong>{quadro.nome}</strong>
                                <p>{quadro.empresa}</p>
                                <p>{quadro.responsavel}</p>
                                <p className={`status ${status === 'Em dia' ? 'success' : 'danger'}`}>
                                  {status === 'Em dia' ? '✅ Em dia' : '❌ Atrasado'}
                                </p>
                                <p>Entrega até: <strong>{previsao}</strong></p>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    {provided.placeholder}

                    {quadros.filter(quadro => quadro.situacao === etapa).length === 0 && (
                      <div className="kanban-card text-muted small">
                        Sem tarefas
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default Tarefas;

import React, { useEffect, useState } from 'react';
import '../styles/kanban.css';

const Kanban = () => {
  const [quadros, setQuadros] = useState([]);
  const [novoQuadro, setNovoQuadro] = useState({
    nome: '',
    empresa: '',
    responsavel: '',
    ativo: true,
    situacao: 'PROJETO NA FILA'
  });

  const token = localStorage.getItem('access');

  useEffect(() => {
    if (!token) return;

    fetch(`${process.env.REACT_APP_API_BASE}/api/quadros/`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setQuadros(Array.isArray(data) ? data : data.results || []);
      })
      .catch(err => {
        console.error('Erro ao buscar quadros:', err);
        setQuadros([]);
      });
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNovoQuadro({
      ...novoQuadro,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    fetch('http://localhost:8000/api/quadros/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(novoQuadro)
    })
      .then(res => res.json())
      .then(data => {
        setQuadros(prev => [...prev, data]);
        setNovoQuadro({
          nome: '',
          empresa: '',
          responsavel: '',
          ativo: true,
          situacao: 'PROJETO NA FILA'
        });
      });
  };

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
      fetch(`http://localhost:8000/api/quadros/${id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => {
          if (res.status === 204) {
            setQuadros(prev => prev.filter(q => q.id !== id));
          }
        })
        .catch(err => console.error('Erro ao excluir tarefa:', err));
    }
  };

  const toggleStatus = (id, statusAtual) => {
    fetch(`http://localhost:8000/api/quadros/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ ativo: !statusAtual })
    })
      .then(res => res.json())
      .then(data => {
        setQuadros(prev =>
          prev.map(q => (q.id === id ? { ...q, ativo: data.ativo } : q))
        );
      })
      .catch(err => console.error('Erro ao atualizar status:', err));
  };

  return (
    <div className="kanban-dashboard container mt-5">
      <h3 className="mb-4 fw-bold">📋 Dashboard de Tarefas</h3>

      <form onSubmit={handleSubmit} className="mb-4 shadow-sm p-3 bg-white rounded border">
        <div className="row g-2">
          <div className="col-md-2">
            <input
              type="text"
              name="nome"
              className="form-control"
              placeholder="Nome do quadro"
              value={novoQuadro.nome}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-2">
            <input
              type="text"
              name="empresa"
              className="form-control"
              placeholder="Empresa"
              value={novoQuadro.empresa}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-2">
            <input
              type="text"
              name="responsavel"
              className="form-control"
              placeholder="Responsável"
              value={novoQuadro.responsavel}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-2">
            <select
              name="situacao"
              className="form-select"
              value={novoQuadro.situacao}
              onChange={handleChange}
            >
              <option value="PROJETO NA FILA">PROJETO NA FILA</option>
              <option value="EM NEGOCIAÇÃO">EM NEGOCIAÇÃO</option>
              <option value="EXECUÇÃO DO TIME">EXECUÇÃO DO TIME</option>
              <option value="APRESENTAÇÃO AO CLIENTE">APRESENTAÇÃO AO CLIENTE</option>
              <option value="VALORES">VALORES</option>
              <option value="ENTREGA AO CLIENTE">ENTREGA AO CLIENTE</option>
            </select>
          </div>
          <div className="col-md-2 d-flex align-items-center">
            <label className="form-check-label me-2">Ativo:</label>
            <input
              type="checkbox"
              name="ativo"
              className="form-check-input"
              checked={novoQuadro.ativo}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-success w-100">
              <i className="fas fa-plus me-1"></i> Criar
            </button>
          </div>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-hover shadow-sm">
          <thead className="table-light">
            <tr className="text-center">
              <th>Nome</th>
              <th>Empresa</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Situação</th>
              <th>Criado em</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {quadros.length > 0 ? (
              quadros.map(quadro => (
                <tr key={quadro.id} className="align-middle">
                  <td>{quadro.nome}</td>
                  <td>{quadro.empresa}</td>
                  <td>{quadro.responsavel}</td>
                  <td className="text-center">
                    <span className={`badge rounded-pill ${quadro.ativo ? 'bg-success' : 'bg-danger'}`}>
                      {quadro.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{quadro.situacao}</td>
                  <td>{quadro.criado_em ? new Date(quadro.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="text-end d-flex justify-content-end gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      title="Ver tarefas"
                      onClick={() => window.location.href = `/tarefas`}
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      className="btn btn-outline-warning btn-sm"
                      title="Alternar status"
                      onClick={() => toggleStatus(quadro.id, quadro.ativo)}
                    >
                      <i className="fas fa-retweet"></i>
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      title="Excluir"
                      onClick={() => handleDelete(quadro.id)}
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted">Nenhum quadro disponível.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Kanban;

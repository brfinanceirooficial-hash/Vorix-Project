import React, { useState, useEffect } from 'react';
import { User, Note } from '../types';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, OperationType, handleStorageError } from '../lib/storage';
import { updateMissionProgress } from '../services/gamificationService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  StickyNote, 
  Tag, 
  Clock,
  MoreVertical,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface NotesViewProps {
  user: User;
}

export const NotesView: React.FC<NotesViewProps> = ({ user }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Geral',
    color: 'bg-zinc-900'
  });

  const colors = [
    { name: 'Zinc', class: 'bg-zinc-900' },
    { name: 'Orange', class: 'bg-orange-600/20' },
    { name: 'Emerald', class: 'bg-emerald-600/20' },
    { name: 'Blue', class: 'bg-blue-600/20' },
    { name: 'Rose', class: 'bg-rose-600/20' },
    { name: 'Amber', class: 'bg-amber-600/20' },
  ];

  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/notes`),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/notes`);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await updateDoc(doc(db, `users/${user.uid}/notes`, editingNote.id), {
          ...formData,
          updatedAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/notes`), {
          ...formData,
          userId: user.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
      setIsModalOpen(false);
      setEditingNote(null);
      setFormData({ title: '', content: '', category: 'Geral', color: 'bg-zinc-900' });
    } catch (error) {
      handleStorageError(error, editingNote ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/notes`);
    }
  };

  const handleDelete = async (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `users/${user.uid}/notes`, id));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleStorageError(error, OperationType.DELETE, `users/${user.uid}/notes/${id}`);
    }
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      category: note.category,
      color: note.color || 'bg-zinc-900'
    });
    setIsModalOpen(true);
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-8">
        <div className="space-y-1.5 lg:space-y-4">
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 lg:px-3 lg:py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <StickyNote className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-orange-500" />
            <span className="text-[8px] lg:text-xs font-bold text-orange-500 uppercase tracking-widest">Anotações Financeiras</span>
          </div>
          <h2 className="text-2xl lg:text-5xl font-black tracking-tight text-white leading-tight">Suas Notas</h2>
          <p className="text-zinc-500 text-[10px] lg:text-lg max-w-2xl font-medium leading-relaxed">
            Organize seus pensamentos, estratégias e lembretes financeiros em um só lugar.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full lg:w-64 bg-zinc-900/50 border border-zinc-800 rounded-xl px-10 py-2.5 lg:py-3 text-xs lg:text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all"
            />
          </div>
          <button 
            onClick={() => {
              setEditingNote(null);
              setFormData({ title: '', content: '', category: 'Geral', color: 'bg-zinc-900' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 lg:px-8 lg:py-3 bg-[#ff4d00] hover:bg-[#e64500] text-white rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all shadow-xl shadow-orange-600/20 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="hidden sm:inline">Nova Nota</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredNotes.map((note, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                key={note.id}
                className={`group relative p-5 lg:p-8 rounded-2xl lg:rounded-[2.5rem] border border-zinc-800/50 hover:border-zinc-700 transition-all flex flex-col space-y-4 lg:space-y-6 overflow-hidden ${note.color || 'bg-zinc-900/40'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Tag className="w-3 h-3 text-orange-500" />
                      <span className="text-[8px] lg:text-[10px] font-bold uppercase tracking-widest text-zinc-500">{note.category}</span>
                    </div>
                    <h3 className="text-sm lg:text-xl font-black text-white tracking-tight group-hover:text-orange-500 transition-colors line-clamp-1">
                      {note.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEdit(note)}
                      className="p-1.5 lg:p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 lg:p-2 hover:bg-rose-500/10 rounded-lg text-zinc-400 hover:text-rose-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-zinc-400 text-[10px] lg:text-base leading-relaxed font-medium line-clamp-4 flex-1">
                  {note.content}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
                  <div className="flex items-center space-x-1.5 text-[8px] lg:text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(note.updatedAt?.seconds * 1000).toLocaleDateString()}</span>
                  </div>
                  <button 
                    onClick={() => openEdit(note)}
                    className="text-orange-500 text-[8px] lg:text-[10px] font-black uppercase tracking-widest flex items-center space-x-1 group/btn"
                  >
                    <span>Ver Detalhes</span>
                    <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Decorative background glow */}
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-orange-600/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-3xl lg:rounded-[4rem] p-10 lg:p-40 text-center space-y-4 lg:space-y-10"
        >
          <div className="relative mx-auto w-16 h-16 lg:w-40 lg:h-40">
            <div className="absolute inset-0 bg-orange-600/20 blur-xl lg:blur-4xl rounded-full animate-pulse" />
            <div className="relative w-full h-full bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center shadow-2xl">
              <StickyNote className="w-8 h-8 lg:w-16 lg:h-16 text-zinc-800" />
            </div>
          </div>
          <div className="space-y-2 lg:space-y-4">
            <h3 className="text-lg lg:text-5xl font-black text-white tracking-tight">Nenhuma nota encontrada</h3>
            <p className="text-zinc-500 text-[10px] lg:text-2xl max-w-md mx-auto font-medium leading-relaxed">
              {searchTerm ? 'Tente buscar por outro termo ou categoria.' : 'Comece a organizar suas finanças criando sua primeira anotação.'}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 lg:px-10 lg:py-4 bg-orange-600 text-white rounded-xl lg:rounded-2xl font-bold text-xs lg:text-lg transition-all hover:bg-orange-500 active:scale-95"
              >
                <Plus className="w-4 h-4 lg:w-6 lg:h-6" />
                <span>Criar Primeira Nota</span>
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl lg:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 lg:p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 lg:p-2 bg-orange-600 rounded-lg lg:rounded-xl">
                    <Edit3 className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white" />
                  </div>
                  <h3 className="text-base lg:text-2xl font-bold">{editingNote ? 'Editar Nota' : 'Nova Nota'}</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
                >
                  <X className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 lg:p-8 space-y-5 lg:space-y-8 overflow-y-auto">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Título</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Estratégia de Investimento"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl px-4 lg:px-6 py-2.5 lg:py-4 focus:outline-none focus:border-orange-500 transition-colors text-xs lg:text-base text-white placeholder:text-zinc-600"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Categoria</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl px-4 lg:px-6 py-2.5 lg:py-4 focus:outline-none focus:border-orange-500 transition-colors text-xs lg:text-base text-white appearance-none"
                      >
                        <option value="Geral">Geral</option>
                        <option value="Investimentos">Investimentos</option>
                        <option value="Dívidas">Dívidas</option>
                        <option value="Metas">Metas</option>
                        <option value="Lembretes">Lembretes</option>
                        <option value="Estratégia">Estratégia</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Cor</label>
                      <div className="flex items-center space-x-2 h-full py-1">
                        {colors.map(c => (
                          <button
                            key={c.class}
                            type="button"
                            onClick={() => setFormData({...formData, color: c.class})}
                            className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full border-2 transition-all ${c.class} ${formData.color === c.class ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Conteúdo</label>
                    <textarea 
                      required
                      placeholder="Escreva suas anotações aqui..."
                      value={formData.content}
                      onChange={e => setFormData({...formData, content: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl px-4 lg:px-6 py-2.5 lg:py-4 focus:outline-none focus:border-orange-500 transition-colors text-xs lg:text-base text-white placeholder:text-zinc-600 min-h-[150px] lg:min-h-[200px] resize-none"
                    />
                  </div>
                </div>

                <div className="pt-1 lg:pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 lg:py-5 rounded-xl lg:rounded-2xl font-bold text-sm lg:text-lg transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center space-x-2 lg:space-x-3"
                  >
                    <Check className="w-4 h-4 lg:w-6 lg:h-6" />
                    <span>{editingNote ? 'Salvar Alterações' : 'Criar Nota'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Excluir Nota</h3>
                <p className="text-zinc-500 text-sm">Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => confirmDelete(showDeleteConfirm)}
                  className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all"
                >
                  Confirmar Exclusão
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

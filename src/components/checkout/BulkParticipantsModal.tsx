import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit2, Upload, Download, Users, Plus, Check, X, CheckCircle, XCircle } from 'lucide-react';
import { validarCpf, formatarCpf, limparCpf } from "@/utils/cpfValidator";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface Participant {
  id: string;
  name: string;
  cpf: string;
  tshirt: string;
  dress: string;
}

interface BulkParticipantsModalProps {
  onImportParticipants: (participants: Omit<Participant, 'id'>[]) => void;
  children: React.ReactNode;
}

const BulkParticipantsModal: React.FC<BulkParticipantsModalProps> = ({ 
  onImportParticipants, 
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [cpfStatuses, setCpfStatuses] = useState<Record<string, 'idle' | 'valid' | 'invalid'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Gerar ID único
  const generateId = () => Math.random().toString(36).substring(2, 11);

  // Processar CSV
  const processCsvData = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const newParticipants: Participant[] = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        
        // Formato esperado: Nome, CPF, Camiseta, Vestido
        const [name = '', cpf = '', tshirt = 'none', dress = 'none'] = columns;
        
        if (name) {
          newParticipants.push({
            id: generateId(),
            name,
            cpf,
            tshirt,
            dress
          });
        }
      }
    });

    return newParticipants;
  };

  // Upload de arquivo CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const newParticipants = processCsvData(csvContent);
      
      if (newParticipants.length > 0) {
        setParticipants(prev => [...prev, ...newParticipants]);
        toast({
          title: "Sucesso",
          description: `${newParticipants.length} participantes importados com sucesso.`
        });
      } else {
        toast({
          title: "Aviso",
          description: "Nenhum participante válido encontrado no arquivo.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  // Processar texto CSV manual
  const handleCsvTextImport = () => {
    if (!csvText.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira os dados CSV.",
        variant: "destructive"
      });
      return;
    }

    const newParticipants = processCsvData(csvText);
    
    if (newParticipants.length > 0) {
      setParticipants(prev => [...prev, ...newParticipants]);
      setCsvText('');
      toast({
        title: "Sucesso",
        description: `${newParticipants.length} participantes adicionados com sucesso.`
      });
    } else {
      toast({
        title: "Aviso",
        description: "Nenhum participante válido encontrado nos dados.",
        variant: "destructive"
      });
    }
  };

  // Adicionar participante individual
  const addParticipant = () => {
    const newParticipant: Participant = {
      id: generateId(),
      name: '',
      cpf: '',
      tshirt: 'none',
      dress: 'none'
    };
    setParticipants(prev => [...prev, newParticipant]);
    setEditingId(newParticipant.id);
  };

  // Editar participante
  const updateParticipant = (id: string, field: keyof Omit<Participant, 'id'>, value: string) => {
    // Formatação especial para CPF
    if (field === 'cpf') {
      const cpfFormatado = formatarCpf(value);
      setParticipants(prev => prev.map(p => 
        p.id === id ? { ...p, [field]: cpfFormatado } : p
      ));
      
      // Validar CPF em tempo real
      if (value.trim() === '') {
        setCpfStatuses(prev => ({ ...prev, [id]: 'idle' }));
      } else if (limparCpf(value).length >= 11) {
        const isValid = validarCpf(value);
        setCpfStatuses(prev => ({ ...prev, [id]: isValid ? 'valid' : 'invalid' }));
      } else {
        setCpfStatuses(prev => ({ ...prev, [id]: 'idle' }));
      }
    } else {
      setParticipants(prev => prev.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      ));
    }
  };

  // Remover participante
  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  // Remover selecionados
  const removeSelected = () => {
    setParticipants(prev => prev.filter(p => !selectedIds.includes(p.id)));
    setSelectedIds([]);
    toast({
      title: "Sucesso",
      description: `${selectedIds.length} participantes removidos.`
    });
  };

  // Selecionar/deselecionar todos
  const toggleSelectAll = () => {
    if (selectedIds.length === participants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(participants.map(p => p.id));
    }
  };

  // Inserir participantes no checkout
  const insertParticipants = () => {
    if (participants.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum participante para inserir.",
        variant: "destructive"
      });
      return;
    }

    const validParticipants = participants.filter(p => p.name.trim());
    
    if (validParticipants.length === 0) {
      toast({
        title: "Erro",
        description: "Pelo menos um participante deve ter nome preenchido.",
        variant: "destructive"
      });
      return;
    }

    onImportParticipants(validParticipants.map(({ id, ...rest }) => rest));
    setIsOpen(false);
    setParticipants([]);
    setSelectedIds([]);
    toast({
      title: "Sucesso",
      description: `${validParticipants.length} participantes inseridos no checkout.`
    });
  };

  // Download template CSV
  const downloadTemplate = () => {
    const csvContent = "Nome,CPF,Camiseta,Vestido\n" +
                      "João Silva,123.456.789-00,M,none\n" +
                      "Maria Santos,987.654.321-00,P,6\n" +
                      "Pedro Oliveira,456.789.123-00,G,none";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_participantes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Gerenciar Participantes em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção de Importação */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Participantes
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload de arquivo */}
                <div className="space-y-2">
                  <Label>Upload de Arquivo CSV</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="flex-1 border-orange-500 focus:border-orange-600 focus:ring-orange-500"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadTemplate}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Formato: Nome, CPF, Camiseta, Vestido
                  </p>
                </div>

                {/* Texto CSV manual */}
                <div className="space-y-2">
                  <Label>Ou Cole os Dados CSV</Label>
                  <Textarea
                    placeholder="Nome,CPF,Camiseta,Vestido&#10;João Silva,123.456.789-00,M,none&#10;Maria Santos,987.654.321-00,P,6"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    type="button"
                    onClick={handleCsvTextImport}
                    size="sm"
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Importar Dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Participantes */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participantes ({participants.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addParticipant}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                  {selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={removeSelected}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover ({selectedIds.length})
                    </Button>
                  )}
                </div>
              </div>

              {participants.length > 0 && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedIds.length === participants.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    Selecionar todos
                  </label>
                </div>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {participants.map((participant) => (
                  <div key={participant.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Checkbox
                        checked={selectedIds.includes(participant.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(prev => [...prev, participant.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== participant.id));
                          }
                        }}
                      />
                      <span className="font-medium text-sm">
                        Participante {participants.indexOf(participant) + 1}
                      </span>
                      <div className="flex gap-1 ml-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(
                            editingId === participant.id ? null : participant.id
                          )}
                        >
                          {editingId === participant.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Edit2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParticipant(participant.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Nome */}
                      <div>
                        <Label className="text-xs">Nome</Label>
                        {editingId === participant.id ? (
                          <Input
                            value={participant.name}
                            onChange={(e) => updateParticipant(participant.id, 'name', e.target.value)}
                            placeholder="Nome do participante"
                            className="h-8"
                          />
                        ) : (
                          <p className="text-sm p-2 bg-gray-50 rounded">
                            {participant.name || 'Não informado'}
                          </p>
                        )}
                      </div>

                      {/* CPF */}
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          CPF
                          {editingId === participant.id && cpfStatuses[participant.id] === 'valid' && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                          {editingId === participant.id && cpfStatuses[participant.id] === 'invalid' && (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                        </Label>
                        {editingId === participant.id ? (
                          <div>
                            <Input
                              value={participant.cpf}
                              onChange={(e) => updateParticipant(participant.id, 'cpf', e.target.value)}
                              placeholder="000.000.000-00"
                              className={`h-8 ${
                                cpfStatuses[participant.id] === 'valid' ? 'border-green-500 focus:border-green-500' :
                                cpfStatuses[participant.id] === 'invalid' ? 'border-red-500 focus:border-red-500' :
                                ''
                              }`}
                            />
                            {cpfStatuses[participant.id] === 'valid' && (
                              <p className="text-xs text-green-600 mt-1">✓ CPF válido</p>
                            )}
                            {cpfStatuses[participant.id] === 'invalid' && (
                              <p className="text-xs text-red-600 mt-1">✗ CPF inválido</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm p-2 bg-gray-50 rounded">
                            {participant.cpf || 'Não informado'}
                          </p>
                        )}
                      </div>

                      {/* Camiseta */}
                      <div>
                        <Label className="text-xs">Camiseta</Label>
                        {editingId === participant.id ? (
                          <Select
                            value={participant.tshirt}
                            onValueChange={(value) => updateParticipant(participant.id, 'tshirt', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              <SelectItem value="PP">PP</SelectItem>
                              <SelectItem value="P">P</SelectItem>
                              <SelectItem value="M">M</SelectItem>
                              <SelectItem value="G">G</SelectItem>
                              <SelectItem value="GG">GG</SelectItem>
                              <SelectItem value="EXGG">EXGG</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm p-2 bg-gray-50 rounded">
                            {participant.tshirt === 'none' ? 'Nenhuma' : participant.tshirt}
                          </p>
                        )}
                      </div>

                      {/* Vestido */}
                      <div>
                        <Label className="text-xs">Vestido</Label>
                        {editingId === participant.id ? (
                          <Select
                            value={participant.dress}
                            onValueChange={(value) => updateParticipant(participant.id, 'dress', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              <SelectItem value="0">0</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="6">6</SelectItem>
                              <SelectItem value="8">8</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="12">12</SelectItem>
                              <SelectItem value="14">14</SelectItem>
                              <SelectItem value="16">16</SelectItem>
                              <SelectItem value="18">18</SelectItem>
                              <SelectItem value="GG">GG</SelectItem>
                              <SelectItem value="EXGG">EXGG</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm p-2 bg-gray-50 rounded">
                            {participant.dress === 'none' ? 'Nenhum' : participant.dress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {participants.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum participante adicionado ainda.</p>
                    <p className="text-sm">Use as opções acima para importar ou adicionar participantes.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={insertParticipants}
              disabled={participants.length === 0}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Check className="h-4 w-4 mr-2" />
              Inserir Participantes ({participants.filter(p => p.name.trim()).length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkParticipantsModal;
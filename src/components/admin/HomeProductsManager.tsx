import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Trash2, Save, X, Upload, Image } from 'lucide-react';

interface HomeProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  button_text: string;
  button_link: string;
  display_order: number;
  is_active: boolean;
}

const HomeProductsManager = () => {
  const [homeProducts, setHomeProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<HomeProduct | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();

  // Formulário para novo/editar produto
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    image_url: '',
    button_text: 'Ver Detalhes',
    button_link: '/loja',
    display_order: 1,
    is_active: true
  });

  useEffect(() => {
    fetchHomeProducts();
  }, []);

  const fetchHomeProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('home_products')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setHomeProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos da home:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos da home.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingProduct) {
        // Atualizar produto existente
        const { error } = await supabase
          .from('home_products')
          .update({
            title: formData.title,
            description: formData.description,
            price: formData.price,
            image_url: formData.image_url,
            button_text: formData.button_text,
            button_link: formData.button_link,
            display_order: formData.display_order,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Produto da home atualizado com sucesso!"
        });
      } else {
        // Criar novo produto
        const { error } = await supabase
          .from('home_products')
          .insert([formData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Produto da home criado com sucesso!"
        });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchHomeProducts();
    } catch (error) {
      console.error('Erro ao salvar produto da home:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o produto da home.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (product: HomeProduct) => {
    setEditingProduct(product);
    setFormData({
      title: product.title,
      description: product.description,
      price: product.price,
      image_url: product.image_url,
      button_text: product.button_text,
      button_link: product.button_link,
      display_order: product.display_order,
      is_active: product.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto da home?')) return;

    try {
      const { error } = await supabase
        .from('home_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Produto da home excluído com sucesso!"
      });
      
      fetchHomeProducts();
    } catch (error) {
      console.error('Erro ao excluir produto da home:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o produto da home.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: 0,
      image_url: '',
      button_text: 'Ver Detalhes',
      button_link: '/loja',
      display_order: 1,
      is_active: true
    });
    setEditingProduct(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se o usuário está autenticado
    if (!user || !session) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa estar logado para fazer upload de imagens.",
        variant: "destructive"
      });
      return;
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      return;
    }

    setUploadingImage(true);

    try {
      // Verificar sessão antes do upload
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        throw new Error('Sessão inválida ou expirada');
      }

      console.log('[DEBUG] Upload iniciado por usuário:', currentSession.user.email);

      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `home-products/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('home-products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública da imagem
      const { data: { publicUrl } } = supabase.storage
        .from('home-products')
        .getPublicUrl(filePath);

      // Atualizar o campo image_url no formulário
      setFormData({ ...formData, image_url: publicUrl });

      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro",
        description: `Não foi possível fazer upload da imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
      // Limpar o input file
      event.target.value = '';
    }
  };

  const handleNewProduct = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Produtos da Home</h2>
          <p className="text-gray-600">Gerencie os produtos exibidos na seção "Produtos Oficiais" da página inicial</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewProduct} className="bg-butterfly-orange hover:bg-butterfly-orange/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto Home
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Editar Produto da Home' : 'Novo Produto da Home'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Coluna Esquerda - Informações Básicas */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <div className="w-2 h-2 bg-butterfly-orange rounded-full mr-2"></div>
                      Informações Básicas
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                          Título do Produto
                        </label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Camiseta Oficial do Evento"
                          className="w-full"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                          Descrição
                        </label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descreva o produto de forma atrativa..."
                          className="w-full min-h-[100px]"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                            Preço (R$)
                          </label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-full"
                            required
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="display_order" className="block text-sm font-medium text-gray-700 mb-2">
                            Ordem de Exibição
                          </label>
                          <Input
                            id="display_order"
                            type="number"
                            min="1"
                            max="3"
                            value={formData.display_order}
                            onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
                            className="w-full"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Coluna Direita - Configurações e Ações */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <div className="w-2 h-2 bg-butterfly-orange rounded-full mr-2"></div>
                      Imagem e Botão
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-2">
                          URL da Imagem
                        </label>
                        <div className="flex gap-2">
                          <Input
                            id="image_url"
                            value={formData.image_url}
                            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="/caminho/para/imagem.jpg ou https://..."
                            className="flex-1"
                            required
                          />
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              disabled={uploadingImage}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="default"
                              disabled={uploadingImage}
                              className="h-10 px-3 flex items-center gap-2 hover:bg-butterfly-orange hover:text-white hover:border-butterfly-orange transition-colors"
                            >
                              {uploadingImage ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              {uploadingImage ? 'Enviando...' : 'Upload'}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-start justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            Use URLs completas, caminhos relativos ou faça upload de uma imagem
                          </p>
                          {formData.image_url && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <Image className="w-3 h-3" />
                              <span>Imagem definida</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="button_text" className="block text-sm font-medium text-gray-700 mb-2">
                          Texto do Botão
                        </label>
                        <Input
                          id="button_text"
                          value={formData.button_text}
                          onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                          placeholder="Ex: Ver Detalhes, Comprar Agora"
                          className="w-full"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="button_link" className="block text-sm font-medium text-gray-700 mb-2">
                          Link do Botão
                        </label>
                        <Input
                          id="button_link"
                          value={formData.button_link}
                          onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                          placeholder="Ex: /loja, /produto/123"
                          className="w-full"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <div className="w-2 h-2 bg-butterfly-orange rounded-full mr-2"></div>
                      Status
                    </h3>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-butterfly-orange focus:ring-butterfly-orange focus:ring-2"
                      />
                      <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                        Produto Ativo
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Produtos inativos não serão exibidos na página inicial
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  {editingProduct ? 'Editando produto existente' : 'Criando novo produto'}
                </div>
                <div className="flex space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="px-6 py-2"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-butterfly-orange hover:bg-butterfly-orange/90 px-6 py-2 font-medium"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingProduct ? 'Atualizar Produto' : 'Criar Produto'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {homeProducts.map((product) => (
          <div key={product.id} className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex space-x-4">
                <div className="w-24 aspect-square overflow-hidden rounded-lg">
                  <img 
                    src={product.image_url} 
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold">{product.title}</h3>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline">Ordem: {product.display_order}</Badge>
                  </div>
                  <p className="text-gray-600 mb-2">{product.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="font-semibold text-butterfly-orange">
                      {product.price > 0 ? `R$ ${product.price.toFixed(2)}` : 'Sem preço'}
                    </span>
                    <span>Botão: "{product.button_text}"</span>
                    <span>Link: {product.button_link}</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(product)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {homeProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Nenhum produto da home encontrado.</p>
          <Button onClick={handleNewProduct} className="bg-butterfly-orange hover:bg-butterfly-orange/90">
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeiro Produto
          </Button>
        </div>
      )}
    </div>
  );
};

export default HomeProductsManager;
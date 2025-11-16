import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shirt, Search, PlusCircle, ImagePlus, Trash2, Edit, Upload, Loader2, Package, ChevronRight, ChevronDown, Eye } from 'lucide-react';
import AdminSidebar from '@/components/AdminSidebar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import HomeProductsManager from '@/components/admin/HomeProductsManager';
import EstoqueContent from '@/components/admin/EstoqueContent';
import { useGroupedClothingDashboard } from '@/hooks/useGroupedClothingDashboard';
import { format } from 'date-fns';

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  in_stock: boolean;
  total_stock: number; // DEPRECATED: was calculated from product_sizes, now based on in_stock boolean
  image: string;
  status: 'Ativo' | 'Esgotado';
  sizes?: ('PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG')[]; // tamanhos do produto
  images?: ProductImage[];
}

const AdminProdutos = () => {
  const [activeTab, setActiveTab] = useState<'gerenciar' | 'home' | 'roupas' | 'estoque'>('gerenciar');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  const [editSelectedImages, setEditSelectedImages] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [currentProductImages, setCurrentProductImages] = useState<ProductImage[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    description: string;
    category: string;
    price: number;
    sizes?: ('PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG')[];
  }>({ name: '', description: '', category: '', price: 0, sizes: [] });
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [editingStockProduct, setEditingStockProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  // Estado para gerenciar produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<{[key: string]: Product[]}>({});
  const [isLoading, setIsLoading] = useState(true);

  // Estados para a aba de roupas agrupadas
  const [clothingSearchTerm, setClothingSearchTerm] = useState('');
  const [clothingStatusFilter, setClothingStatusFilter] = useState('all');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  
  // Estados para seleção múltipla e exclusão em lote
  const [selectedClothingItems, setSelectedClothingItems] = useState<Set<string>>(new Set());
  const [selectAllClothingItems, setSelectAllClothingItems] = useState(false);
  const [isDeletingClothing, setIsDeletingClothing] = useState(false);
  
  // Estado para modal de detalhes do item
  const [selectedClothingItem, setSelectedClothingItem] = useState<any>(null);

  // Funções auxiliares para formatação
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const normalizePrice = (price: number): number => {
    if (price > 1000 && Number.isInteger(price)) {
      return price / 100;
    }
    return price;
  };

  // Hook para buscar roupas agrupadas
  const {
    clothingGroups,
    loading: clothingLoading,
    error: clothingError,
    stats: clothingStats
  } = useGroupedClothingDashboard({
    paymentStatus: clothingStatusFilter === 'all' ? undefined : clothingStatusFilter,
    search: clothingSearchTerm.trim() || undefined
  }, 50);

  // Função para buscar imagens dos produtos
  const fetchProductImages = async (productIds: string[]) => {
    const missingIds = productIds.filter(id => !productImages[id]);
    if (missingIds.length === 0) return;

    try {
      // Buscar imagens da tabela product_images
      const { data: imagesData } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_primary, display_order')
        .in('product_id', missingIds)
        .order('display_order');

      // Buscar produtos que não têm imagens na product_images
      const { data: productsData } = await supabase
        .from('products')
        .select('id, image_url')
        .in('id', missingIds);

      const newImages: Record<string, string> = {};

      // Processar imagens da product_images
      if (imagesData) {
        imagesData.forEach((img: any) => {
          if (!newImages[img.product_id] && img.image_url) {
            newImages[img.product_id] = img.image_url;
          }
        });
      }

      // Processar imagens dos produtos (fallback)
      if (productsData) {
        productsData.forEach((product: any) => {
          if (!newImages[product.id] && product.image_url) {
            newImages[product.id] = product.image_url;
          }
        });
      }

      setProductImages(prev => ({ ...prev, ...newImages }));
    } catch (error) {
      console.error('Erro ao buscar imagens dos produtos:', error);
    }
  };

  // Efeito para buscar imagens quando os grupos mudam
  useEffect(() => {
    if (clothingGroups.length > 0) {
      const allProductIds = new Set<string>();
      clothingGroups.forEach(group => {
        if (group.items) {
          group.items.forEach(item => {
            if (item.product_id) {
              allProductIds.add(item.product_id);
            }
          });
        }
      });
      fetchProductImages(Array.from(allProductIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clothingGroups]);

  // Efeito para atualizar estado do "selecionar todos" quando grupos mudam
  useEffect(() => {
    const allItemIds = new Set<string>();
    clothingGroups.forEach(group => {
      if (group.items) {
        group.items.forEach(item => {
          // Usar display_id se disponível para seleção, senão usar id
          allItemIds.add(item.display_id || item.id);
        });
      }
    });
    
    // Se todos os itens estão selecionados, marcar "selecionar todos" como true
    if (allItemIds.size > 0 && selectedClothingItems.size === allItemIds.size) {
      setSelectAllClothingItems(true);
    } else if (selectedClothingItems.size === 0) {
      setSelectAllClothingItems(false);
    } else {
      // Seleção parcial
      setSelectAllClothingItems(false);
    }
  }, [clothingGroups, selectedClothingItems]);

  // Função para alternar expansão de pacote
  const togglePackageExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedPackages(newExpanded);
  };

  // Funções para seleção múltipla de roupas
  // Usa display_id para seleção (para itens expandidos) e original_id para exclusão
  const handleClothingItemSelection = (itemId: string, isChecked: boolean) => {
    const newSelected = new Set(selectedClothingItems);
    if (isChecked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedClothingItems(newSelected);
  };

  // Função para selecionar todos os itens de roupas
  const handleSelectAllClothingItems = () => {
    if (selectAllClothingItems) {
      setSelectedClothingItems(new Set());
      setSelectAllClothingItems(false);
    } else {
      const allIds = new Set<string>();
      clothingGroups.forEach(group => {
        if (group.items) {
          group.items.forEach(item => {
            // Usar display_id se disponível para seleção, senão usar id
            allIds.add(item.display_id || item.id);
          });
        }
      });
      setSelectedClothingItems(allIds);
      setSelectAllClothingItems(true);
    }
  };

  // Função para exclusão múltipla de itens de roupas
  const deleteSelectedClothingItems = async () => {
    if (selectedClothingItems.size === 0) return;
    
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${selectedClothingItems.size} item(s) selecionado(s)? Esta ação não pode ser desfeita.`
    );
    
    if (!confirmed) return;
    
    setIsDeletingClothing(true);
    try {
      // Coletar todos os IDs originais únicos dos itens selecionados
      const idsToDeleteSet = new Set<string>();
      clothingGroups.forEach(group => {
        if (group.items) {
          group.items.forEach(item => {
            // Verificar se o item está selecionado (usando display_id ou id)
            const itemSelectionId = item.display_id || item.id;
            const isSelected = selectedClothingItems.has(itemSelectionId);
            
            if (isSelected) {
              // Usar original_id se disponível, senão usar id (que é sempre o ID original do banco)
              const idToUse = item.original_id || item.id;
              idsToDeleteSet.add(idToUse);
            }
          });
        }
      });

      const idsToDelete = Array.from(idsToDeleteSet);
      if (idsToDelete.length === 0) {
        throw new Error('Nenhum ID válido encontrado para exclusão');
      }

      const { error } = await supabase
        .from('order_items')
        .delete()
        .in('id', idsToDelete);
      
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: `${selectedClothingItems.size} item(s) excluído(s) com sucesso!`,
        variant: 'default',
      });
      
      setSelectedClothingItems(new Set());
      setSelectAllClothingItems(false);
      
      // Recarregar dados
      window.location.reload();
      
    } catch (error) {
      console.error('Erro ao excluir itens:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir itens. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingClothing(false);
    }
  };

  // Estado para o formulário de cadastro
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: 0,
    in_stock: true,
    image_url: '',
    sizes: [] as ('PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG')[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Estados para seleção múltipla e exclusão
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAllItems, setSelectAllItems] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estados para seleção múltipla de produtos
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const [stockFormData, setStockFormData] = useState({
    quantity: 0
  });

  // Função para buscar produtos (reutilizável)
  const fetchProducts = async () => {
    console.log('[DEBUG] fetchProducts chamada');
    setIsLoading(true);
    
    // Mapeamento das categorias do enum
    const categoryMap = new Map([
      ['camiseta', 'Camisetas'],
      ['vestido', 'Vestidos'],
      ['acessorio', 'Acessórios']
    ]);
    
    // Buscar produtos
    console.log('[DEBUG] Iniciando query do Supabase...');
    
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        category,
        price,
        image_url,
        in_stock,
        created_at,
        updated_at,
        sizes
       `);
       
    console.log('[DEBUG] Query executada. Error:', error, 'Data:', data);
       
    if (error) {
      console.error('[DEBUG] Erro detalhado:', error);
      toast({
        title: 'Erro ao carregar produtos',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    
    console.log('[DEBUG] Dados retornados do Supabase:', data);
    console.log('[DEBUG] Quantidade de produtos:', data?.length || 0);
    
    const formattedProducts: Product[] = (data || []).map((product: any) => {
      const categoryName = categoryMap.get(product.category) || '';
      // Para produtos com tamanhos, consideramos que há estoque se in_stock for true
      const totalStock = product.in_stock ? 1 : 0;
      
      console.log(`[DEBUG] Produto ${product.id}: nome="${product.name}", in_stock=${product.in_stock}, total_stock=${totalStock}`);
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        category: categoryName.toLowerCase() === 'camisetas' ? 'camiseta' : 'vestido',
        price: Number(product.price),
        in_stock: product.in_stock,
        total_stock: totalStock,
        image: product.image_url || '',
        status: totalStock <= 0 ? 'Esgotado' : 'Ativo',
        sizes: product.sizes || [],
      };
    });
    
    setProducts(formattedProducts);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [toast]);

  useEffect(() => {
    const groupProducts = () => {
      const clothingProducts = products.filter(p => p.category === 'camiseta' || p.category === 'vestido');
      const grouped = clothingProducts.reduce((acc, product) => {
        const groupName = product.name.split(' - ')[0];
        if (!acc[groupName]) {
          acc[groupName] = [];
        }
        acc[groupName].push(product);
        return acc;
      }, {} as {[key: string]: Product[]});
      setGroupedProducts(grouped);
    };

    if (products.length > 0) {
      groupProducts();
    }
  }, [products]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] handleImageChange chamada para CRIAÇÃO');
    const files = Array.from(e.target.files || []);
    console.log('[DEBUG] Arquivos selecionados:', files.length);
    
    if (files.length === 0) return;

    // Validar tipos de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos JPEG, PNG e WebP são permitidos.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    // Validar tamanho dos arquivos (máximo 5MB cada)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "Arquivo muito grande",
        description: "Cada imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }
    
    setSelectedImages(files);
    setCurrentImageIndex(0);
    
    // Processar todas as imagens
    const previews: string[] = [];
    let processedCount = 0;
    
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews[index] = reader.result as string;
        processedCount++;
        
        if (processedCount === files.length) {
          setImagePreviews(previews);
          setMainImageIndex(0);
          // Usar a primeira imagem como principal
          setNewProduct(prev => ({ ...prev, image_url: previews[0] }));
          console.log('[DEBUG] Todas as imagens processadas:', previews.length);
        }
      };
      reader.onerror = () => {
        console.error('[DEBUG] Erro ao ler arquivo:', file.name);
        toast({
          title: "Erro ao processar imagem",
          description: `Não foi possível processar a imagem ${file.name}`,
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    });
    
    // Limpar o valor do input para permitir seleção do mesmo arquivo novamente
    e.target.value = '';
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] handleEditImageChange chamada para EDIÇÃO - múltiplas imagens');
    const files = Array.from(e.target.files || []);
    console.log('[DEBUG] Arquivos selecionados para edição:', files.length);
    
    if (files.length === 0) return;

    // Validar tipos de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos JPEG, PNG e WebP são permitidos.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    // Validar tamanho dos arquivos (máximo 5MB cada)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "Arquivo muito grande",
        description: "Cada imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }
    
    setEditSelectedImages(files);
    console.log('[DEBUG] editSelectedImages definido:', files.map(f => f.name));
    
    const previews: string[] = [];
    let processedCount = 0;
    
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        previews[index] = result;
        processedCount++;
        
        if (processedCount === files.length) {
          setEditImagePreviews(previews);
          console.log('[DEBUG] Todas as imagens de edição processadas:', previews.length);
        }
      };
      reader.onerror = () => {
        console.error('[DEBUG] Erro ao ler arquivo de edição:', file.name);
        toast({
          title: "Erro ao processar imagem",
          description: `Não foi possível processar a imagem ${file.name}`,
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    });
    
    // Limpar o valor do input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };


  const handleEditClick = async (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      sizes: product.sizes || [],
    });
    
    // Carregar imagens existentes do produto
    try {
      const { data: images, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');
      
      if (error) {
        console.error('Erro ao carregar imagens:', error);
        // Fallback para imagem única
        setCurrentProductImages([]);
        setEditImagePreviews(product.image ? [product.image] : []);
      } else {
        setCurrentProductImages(images || []);
        setEditImagePreviews(images?.map(img => img.image_url) || []);
      }
    } catch (error) {
      console.error('Erro ao buscar imagens:', error);
      setCurrentProductImages([]);
      setEditImagePreviews(product.image ? [product.image] : []);
    }
  };

  const handleEditDialogClose = () => {
    setEditingProduct(null);
    setEditFormData({ name: '', description: '', category: '', price: 0, sizes: [] });
    setEditSelectedImages([]);
    setEditImagePreviews([]);
    setCurrentProductImages([]);
  };

  const handleStockDialogClose = () => {
    setStockFormData({ quantity: 0 });
  };

  const handleRemoveDialogClose = () => {
    // Função para fechar o diálogo de remoção
  };

  const handleConfirmRemove = async (productId: string) => {
    await handleRemoveProduct(productId);
  };

  // Função para fazer upload de múltiplas imagens
  const uploadMultipleImages = async (files: File[], productId: string): Promise<string[]> => {
    console.log('🔍 Iniciando upload de imagens...');
    
    // Verificar autenticação antes do upload
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('[DEBUG] Erro ao verificar sessão:', authError);
      throw new Error(`Erro de autenticação: ${authError.message}`);
    }
    
    if (!session) {
      console.error('[DEBUG] Usuário não autenticado');
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }
    
    console.log('[DEBUG] Usuário autenticado:', session.user.email);
    console.log('[DEBUG] Iniciando upload de', files.length, 'imagens para produto', productId);
    
    // Tentar criar o bucket se não existir
    try {
      console.log('🪣 Verificando/criando bucket product-images...');
      
      // Primeiro, tentar listar buckets para ver se existe
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('⚠️ Erro ao listar buckets:', listError);
      } else {
        const bucketExists = buckets?.some(bucket => bucket.id === 'product-images');
        console.log('🔍 Bucket product-images existe:', bucketExists);
        
        if (!bucketExists) {
          console.log('🆕 Criando bucket product-images...');
          const { data: newBucket, error: createError } = await supabase.storage.createBucket('product-images', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            fileSizeLimit: 5242880 // 5MB
          });
          
          if (createError) {
            console.error('❌ Erro ao criar bucket:', createError);
          } else {
            console.log('✅ Bucket criado com sucesso:', newBucket);
          }
        }
      }
    } catch (bucketError) {
      console.warn('⚠️ Erro na configuração do bucket:', bucketError);
      // Continuar mesmo se houver erro na criação do bucket
    }
    
    const uploadPromises = files.map(async (file, index) => {
      const fileExtension = file.name.split('.').pop();
      const fileName = `product-${productId}-${Date.now()}-${index}.${fileExtension}`;
      
      console.log('[DEBUG] Fazendo upload do arquivo:', fileName);
      
      // Tentar upload com diferentes estratégias
      let uploadResult;
      let uploadError;
      
      // Estratégia 1: Upload normal
      try {
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (error) throw error;
        uploadResult = data;
      } catch (error1) {
        console.warn(`⚠️ Estratégia 1 falhou para ${fileName}:`, error1);
        uploadError = error1;
        
        // Estratégia 2: Upload com upsert
        try {
          const { data, error } = await supabase.storage
            .from('product-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (error) throw error;
          uploadResult = data;
          uploadError = null;
        } catch (error2) {
          console.warn(`⚠️ Estratégia 2 falhou para ${fileName}:`, error2);
          uploadError = error2;
          
          // Estratégia 3: Upload com nome único
          try {
            const uniqueFileName = `product-${productId}-${Date.now()}-${Math.random().toString(36).substring(2)}-${index}.${fileExtension}`;
            const { data, error } = await supabase.storage
              .from('product-images')
              .upload(uniqueFileName, file, {
                cacheControl: '3600',
                upsert: true
              });
              
            if (error) throw error;
            uploadResult = data;
            uploadError = null;
          } catch (error3) {
            console.error(`❌ Todas as estratégias falharam para ${fileName}:`, error3);
            uploadError = error3;
          }
        }
      }

      if (uploadError) {
        console.error('[DEBUG] Erro detalhado no upload:', {
          fileName,
          error: uploadError,
          message: uploadError.message,
          details: uploadError.details || uploadError
        });
        throw new Error(`Erro no upload da imagem ${file.name}: ${uploadError.message}`);
      }

      console.log('[DEBUG] Upload bem-sucedido:', uploadResult.path);
      
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(uploadResult.path);

      return urlData.publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  // Função para salvar imagens na tabela product_images
  const saveProductImages = async (productId: string, imageUrls: string[]) => {
    // Primeiro, remover imagens existentes
    await supabase
      .from('product_images')
      .delete()
      .eq('product_id', productId);

    // Inserir novas imagens
    const imageRecords = imageUrls.map((url, index) => ({
      product_id: productId,
      image_url: url,
      display_order: index,
      is_primary: index === 0, // Primeira imagem é a principal
      alt_text: `Imagem ${index + 1}`
    }));

    const { error } = await supabase
      .from('product_images')
      .insert(imageRecords);

    if (error) {
      throw new Error(`Erro ao salvar imagens: ${error.message}`);
    }
  };

  // Função para atualizar produto
  const handleUpdateProduct = async (productId: string, updatedData: Partial<Product>) => {
    try {
      console.log('[DEBUG] handleUpdateProduct chamada com:', {
        productId,
        updatedData
      });

      let primaryImageUrl = updatedData.image;

      // Se há novas imagens selecionadas, fazer upload
      if (editSelectedImages.length > 0) {
        try {
          console.log('[DEBUG] Fazendo upload de', editSelectedImages.length, 'imagens');
          
          // Upload das múltiplas imagens
          const imageUrls = await uploadMultipleImages(editSelectedImages, productId);
          
          // Salvar imagens na tabela product_images
          await saveProductImages(productId, imageUrls);
          
          // A primeira imagem se torna a imagem principal
          primaryImageUrl = imageUrls[0];
          
          console.log('[DEBUG] Imagens carregadas:', imageUrls);
        } catch (error) {
          console.error('Erro no processo de upload:', error);
          toast({
            title: "Erro no upload das imagens",
            description: error instanceof Error ? error.message : "Falha ao processar as imagens",
            variant: "destructive"
          });
          return;
        }
      }

      // O campo category no banco é TEXT, não UUID - usar string diretamente
      const updatePayload = {
        name: updatedData.name,
        description: updatedData.description,
        price: updatedData.price,
        category: updatedData.category?.toLowerCase(), // Garantir minúsculas
        image_url: primaryImageUrl,
        sizes: updatedData.sizes || []
      };

      console.log('[DEBUG] Payload para Supabase:', updatePayload);

      // Atualizar no banco de dados (incluindo campos de medidas)
      const { data, error } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', productId)
        .select();

      console.log('[DEBUG] Resposta do Supabase:', { data, error });
      console.log('[DEBUG] Linhas afetadas:', data?.length || 0);

      if (error) {
        toast({
          title: "Erro ao atualizar produto",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (!data || data.length === 0) {
        console.error('[DEBUG] Nenhuma linha foi atualizada - possível problema de permissão RLS');
        toast({
          title: "Erro ao atualizar produto",
          description: "Nenhuma linha foi atualizada. Verifique as permissões.",
          variant: "destructive"
        });
        return;
      }

      // Os tamanhos são armazenados diretamente na coluna 'sizes' da tabela products
      // Não há necessidade de operações adicionais na tabela product_sizes

      // Atualizar estado local
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { ...product, ...updatedData }
            : product
        )
      );
      
      toast({
        title: "Produto atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      
      // Limpar estados de imagem após atualização bem-sucedida
      setEditSelectedImages([]);
      setEditImagePreviews([]);
      
      handleEditDialogClose();
      fetchProducts(); // Recarregar produtos para garantir sincronização
    } catch (error) {
      toast({
        title: "Erro ao atualizar produto",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    }
  };

  // Função para atualizar estoque
  const handleUpdateStock = async (productId: string, newStock: number) => {
    try {
      // Atualizar stock_quantity e in_stock na tabela products
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: newStock,
          in_stock: newStock > 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Atualizar estado local
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { 
                ...product, 
                in_stock: newStock > 0, 
                total_stock: newStock,
                status: newStock > 0 ? 'Ativo' : 'Esgotado' 
              }
            : product
        )
      );
      
      toast({
        title: 'Estoque atualizado',
        description: `Estoque atualizado para ${newStock} unidades.`,
      });
      
      setEditingStockProduct(null);
      setNewStockValue(0);
      
      // Recarregar produtos para garantir sincronização
      await fetchProducts();
      
    } catch (error: any) {
      console.error('Erro ao atualizar estoque:', error);
      toast({
        title: 'Erro ao atualizar estoque',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  // Função para remover produto
  const handleRemoveProduct = async (productId: string) => {
    try {
      // Primeiro, verificar se o produto ainda existe
      const { data: existingProduct, error: checkError } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .single();

      if (checkError || !existingProduct) {
        // Produto já foi removido, apenas atualizar o estado local
        setProducts(prevProducts => 
          prevProducts.filter(product => product.id !== productId)
        );
        
        toast({
          title: "Produto já removido",
          description: "O produto já foi removido anteriormente.",
          variant: "default"
        });
        
        // Recarregar produtos para garantir sincronização
        await fetchProducts();
        return;
      }

      // Verificar se há itens no carrinho que referenciam este produto
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (cartError) {
        console.error('Erro ao verificar itens do carrinho:', cartError);
      }

      // Se há itens no carrinho, removê-los primeiro
      if (cartItems && cartItems.length > 0) {
        const { error: deleteCartError } = await supabase
          .from('cart_items')
          .delete()
          .eq('product_id', productId);

        if (deleteCartError) {
          console.error('Erro ao remover itens do carrinho:', deleteCartError);
          toast({
            title: "Erro ao remover produto",
            description: "Não foi possível remover os itens do carrinho associados ao produto.",
            variant: "destructive"
          });
          return;
        }
      }

      // Verificar e remover itens de pedidos se necessário
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (orderItems && orderItems.length > 0) {
        toast({
          title: "Não é possível remover produto",
          description: "Este produto possui pedidos associados e não pode ser removido. Considere desativá-lo.",
          variant: "destructive"
        });
        return;
      }

      // DEPRECATED: product_sizes table removed - sizes are now stored in products.sizes array
      // No need to delete from product_sizes table anymore

      // Agora remover o produto
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .select();

      if (error) {
        console.error('Erro ao remover produto:', error);
        toast({
          title: "Erro ao remover produto",
          description: error.message || "Falha na autenticação. Faça login como administrador.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se algum produto foi realmente removido
      if (!data || data.length === 0) {
        toast({
          title: "Erro ao remover produto",
          description: "Produto não encontrado ou não foi possível remover.",
          variant: "destructive"
        });
        return;
      }

      // Atualizar estado local apenas se a remoção foi bem-sucedida
      setProducts(prevProducts => 
        prevProducts.filter(product => product.id !== productId)
      );
      
      toast({
        title: "Produto removido",
        description: "O produto foi removido com sucesso.",
      });
      
      // Recarregar produtos para garantir sincronização
      await fetchProducts();
    } catch (error: any) {
      console.error('Erro inesperado ao remover produto:', error);
      toast({
        title: "Erro ao remover produto",
        description: error?.message || "Ocorreu um erro inesperado. Verifique sua autenticação.",
        variant: "destructive"
      });
    }
  };

  // Função para abrir diálogo de estoque
  const handleStockClick = (product: Product) => {
    setEditingStockProduct(product);
    setNewStockValue(product.total_stock);
  };

  // Função para cadastrar produto no Supabase
  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.category || !newProduct.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, categoria e preço são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    if (!newProduct.sizes || newProduct.sizes.length === 0) {
      toast({
        title: "Tamanhos obrigatórios",
        description: "Selecione pelo menos um tamanho para o produto.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Verificar se já existe um produto com o mesmo nome
      const { data: existingProduct, error: checkError } = await supabase
        .from('products')
        .select('id, name')
        .eq('name', newProduct.name.trim())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar produto existente:', checkError);
        throw checkError;
      }

      if (existingProduct) {
        toast({
          title: "Produto já existe",
          description: `Já existe um produto com o nome "${newProduct.name}". Escolha um nome diferente.`,
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }
      // Garantir que a categoria esteja em minúsculas conforme constraint do banco
      const categoryValue = newProduct.category.toLowerCase();
      const productName = newProduct.name.trim(); // Remover espaços extras

      // Primeiro, criar o produto sem imagem
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: newProduct.name,
          description: newProduct.description,
          category: categoryValue,
          price: newProduct.price,
          image_url: null, // Será atualizado após upload das imagens
          in_stock: newProduct.in_stock,
          sizes: newProduct.sizes || []
        })
        .select()
        .single();

      if (error) {
        console.error('[DEBUG] Erro ao criar produto:', error);
        toast({
          title: "Erro ao criar produto",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      console.log('[DEBUG] Produto criado:', data);

      // Agora fazer upload das imagens com o productId
      let imageUrl = null;
      let uploadedImageUrls: string[] = [];

      if (selectedImages.length > 0) {
        console.log('[DEBUG] Fazendo upload de', selectedImages.length, 'imagens');
        
        // Upload de todas as imagens usando o ID do produto criado
        uploadedImageUrls = await uploadMultipleImages(selectedImages, data.id);
        
        if (uploadedImageUrls.length > 0) {
          imageUrl = uploadedImageUrls[0]; // Primeira imagem como principal
          console.log('[DEBUG] URLs das imagens:', uploadedImageUrls);
          
          // Atualizar o produto com a URL da imagem principal
          const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', data.id);
            
          if (updateError) {
            console.error('[DEBUG] Erro ao atualizar imagem do produto:', updateError);
          }
        }
        
        // Salvar todas as imagens na tabela product_images
        await saveProductImages(data.id, uploadedImageUrls);
      }

      // Os tamanhos são armazenados diretamente na coluna 'sizes' da tabela products
      // Não há necessidade de criar entradas separadas na tabela product_sizes

      toast({
        title: "Produto criado",
        description: "O produto foi criado com sucesso.",
      });
      
      // Limpar estados
      setNewProduct({ name: '', description: '', category: '', price: 0, in_stock: true, image_url: '', sizes: [] });
      setSelectedImages([]);
      setImagePreviews([]);
      setCurrentImageIndex(0);
      setIsDialogOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('[DEBUG] Erro inesperado:', error);
      toast({
        title: "Erro ao criar produto",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products
    .filter(product => product.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(product => categoryFilter === 'all' || product.category === (categoryFilter === 'camisetas' ? 'camiseta' : 'vestido'));

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-100 text-green-800';
      case 'Inativo':
        return 'bg-gray-100 text-gray-800';
      case 'Esgotado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Funções para seleção múltipla
  const handleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    
    setSelectedItems(newSelected);
    
    // Atualizar estado do "selecionar todos"
    const allItemIds = filteredProducts.map(product => product.id);
    setSelectAllItems(allItemIds.length > 0 && allItemIds.every(id => newSelected.has(id)));
  };

  const handleSelectAllItems = (checked: boolean) => {
    if (checked) {
      const allItemIds = filteredProducts.map(product => product.id);
      setSelectedItems(new Set(allItemIds));
      setSelectAllItems(true);
    } else {
      setSelectedItems(new Set());
      setSelectAllItems(false);
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;

    setIsDeleting(true);
    
    try {
      const itemsToDelete = Array.from(selectedItems);
      
      // Excluir produtos do Supabase
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', itemsToDelete);

      if (error) {
        console.error('Erro ao excluir produtos:', error);
        toast({
          title: 'Erro ao excluir produtos',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Limpar seleções
      setSelectedItems(new Set());
      setSelectAllItems(false);

      // Atualizar lista de produtos
      await fetchProducts();

      toast({
        title: 'Produtos excluídos',
        description: `${itemsToDelete.length} produto(s) excluído(s) com sucesso.`,
      });

    } catch (error) {
      console.error('Erro inesperado ao excluir produtos:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao excluir os produtos.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">Produtos</h1>
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'gerenciar' | 'home' | 'roupas' | 'estoque')}>
            <TabsList>
              <TabsTrigger value="gerenciar">Gerenciar Produtos</TabsTrigger>
              <TabsTrigger value="home">Produtos da Home</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
            </TabsList>
            <TabsContent value="gerenciar">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="inline-flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg shadow-orange-500/25 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]">
                    <PlusCircle className="h-4 w-4" /> 
                    <span className="hidden sm:inline">Adicionar Produtos</span>
                    <span className="sm:hidden">Adicionar</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Produto</DialogTitle>
                    <DialogDescription>
                      Preencha os detalhes do produto abaixo.
                    </DialogDescription>
                  </DialogHeader>
                  {/* ... (conteúdo do dialog) ... */}
                </DialogContent>
              </Dialog>

              {/* Tabela de Produtos */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Todos os Produtos</CardTitle>
                  <CardDescription>Gerencie seus produtos cadastrados.</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Versão Desktop da Tabela */}
                  <div className="hidden md:block rounded-lg border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="py-3 px-2 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-500 w-12">
                            <span className="sr-only">Seleção</span>
                          </th>
                          <th className="py-3 px-2 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-500">Produto</th>
                          <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500 hidden lg:table-cell">Categoria</th>
                          <th className="py-3 px-2 sm:px-4 text-right text-xs sm:text-sm font-medium text-gray-500">Preço</th>
                          <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500 hidden xl:table-cell">Estoque</th>
                          <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500 hidden xl:table-cell">Status</th>
                          <th className="py-3 px-2 sm:px-4 text-right text-xs sm:text-sm font-medium text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr key={product.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2 sm:px-4">
                              <Checkbox
                                checked={selectedItems.has(product.id)}
                                onCheckedChange={() => handleItemSelection(product.id)}
                              />
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              <div className="flex items-center min-w-0">
                                <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden mr-2 sm:mr-3">
                                  <img 
                                    src={product.image} 
                                    alt={product.name} 
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm sm:text-base truncate">{product.name}</div>
                                  <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px] sm:max-w-xs">
                                    {product.description}
                                  </div>
                                  <div className="lg:hidden mt-1">
                                    <div className="flex items-center gap-2">
                                      <Shirt className="h-3 w-3 text-gray-500" />
                                      <span className="text-xs capitalize text-gray-600">
                                        {product.category === 'camiseta' ? 'Camiseta' : 'Vestido'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="xl:hidden mt-1 flex items-center gap-3 text-xs">
                                    <span className={!product.in_stock ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
                                      {product.in_stock ? 'Em Estoque' : 'Esgotado'}
                                    </span>
                                    <span className={`py-1 px-2 rounded ${getStatusBadgeClass(product.status)}`}>
                                      {product.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-center hidden lg:table-cell">
                              <div className="flex items-center justify-center">
                                <Shirt className="mr-1 h-4 w-4 text-gray-500" />
                                <span className="text-sm capitalize">
                                  {product.category === 'camiseta' ? 'Camiseta' : 'Vestido'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-right">
                              <span className="font-medium text-sm sm:text-base">R$ {product.price.toFixed(2)}</span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-center hidden xl:table-cell">
                              <span className={!product.in_stock ? "text-red-500 font-medium text-sm" : "text-green-600 font-medium text-sm"}>
                                {product.in_stock ? 'Em Estoque' : 'Esgotado'}
                              </span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-center hidden xl:table-cell">
                              <span className={`text-xs py-1 px-2 rounded ${getStatusBadgeClass(product.status)}`}>
                                {product.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-right">
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                                      onClick={() => handleEditClick(product)}
                                    >
                                      <span className="hidden sm:inline">Editar</span>
                                      <Edit className="h-3 w-3 sm:hidden" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Editar Produto</DialogTitle>
                                      <DialogDescription>
                                        Altere os detalhes do produto.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                        <label htmlFor="edit-name" className="text-left sm:text-right text-sm font-medium">
                                          Nome
                                        </label>
                                        <Input 
                                          id="edit-name" 
                                          className="sm:col-span-3" 
                                          value={editFormData.name}
                                          onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                        <label htmlFor="edit-description" className="text-left sm:text-right text-sm font-medium">
                                          Descrição
                                        </label>
                                        <Input 
                                          id="edit-description" 
                                          className="sm:col-span-3" 
                                          value={editFormData.description}
                                          onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                        <label htmlFor="edit-category" className="text-left sm:text-right text-sm font-medium">
                                          Categoria
                                        </label>
                                        <Select 
                                          value={editFormData.category}
                                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value }))}
                                        >
                                          <SelectTrigger className="sm:col-span-3">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="camiseta">Camiseta</SelectItem>
                                            <SelectItem value="vestido">Vestido</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                        <label htmlFor="edit-price" className="text-left sm:text-right text-sm font-medium">
                                          Preço (R$)
                                        </label>
                                        <Input 
                                          id="edit-price" 
                                          className="sm:col-span-3" 
                                          type="number" 
                                          value={editFormData.price}
                                          onChange={(e) => setEditFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                                        />
                                      </div>
                                      {/* Campo de Tamanhos Múltiplos */}
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                                        <label className="text-left sm:text-right text-sm font-medium">
                                          Tamanhos
                                        </label>
                                        <div className="sm:col-span-3 space-y-2">
                                          <div className="flex flex-wrap gap-3">
                                            {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].map((size) => (
                                              <label key={size} className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={editFormData.sizes?.includes(size as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG') || false}
                                                  onChange={(e) => {
                                                    const currentSizes = editFormData.sizes || [];
                                                    if (e.target.checked) {
                                                      setEditFormData(prev => ({
                                                        ...prev,
                                                        sizes: [...currentSizes, size as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG']
                                                      }));
                                                    } else {
                                                      setEditFormData(prev => ({
                                                        ...prev,
                                                        sizes: currentSizes.filter(s => s !== size)
                                                      }));
                                                    }
                                                  }}
                                                  className="rounded border-gray-300 text-butterfly-orange focus:ring-butterfly-orange"
                                                />
                                                <span className="text-sm font-medium">{size}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            Selecione um ou mais tamanhos disponíveis para este produto
                                          </p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                        <label className="text-left sm:text-right text-sm font-medium">
                                          Imagens
                                        </label>
                                        <div className="col-span-3 space-y-4">
                                          <div className="flex items-center gap-4">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              onClick={() => document.getElementById('edit-image-upload')?.click()}
                                              className="w-full"
                                            >
                                              <ImagePlus className="mr-2 h-4 w-4" />
                                              Alterar Imagens
                                            </Button>
                                          </div>
                                          {/* Grid de pré-visualização das imagens */}
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {editImagePreviews.length > 0 ? (
                                              editImagePreviews.map((preview, index) => (
                                                <div key={index} className="relative w-full h-32 rounded-md overflow-hidden border">
                                                  <img
                                                    src={preview}
                                                    alt={`Imagem ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                                                    {index + 1}
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="col-span-full text-center text-gray-500 py-8">
                                                Nenhuma imagem selecionada
                                              </div>
                                            )}
                                          </div>
                                          {editImagePreviews.length > 0 && (
                                            <p className="text-xs text-gray-500">
                                              {editImagePreviews.length} imagem(ns) selecionada(s). A primeira será a imagem principal.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" className="mr-2" onClick={handleEditDialogClose}>
                                        Cancelar
                                      </Button>
                                      <Button 
                                        className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                                        onClick={() => handleUpdateProduct(product.id, {
                                          name: editFormData.name,
                                          description: editFormData.description,
                                          price: editFormData.price,
                                          category: editFormData.category as 'camiseta' | 'vestido',
                                          image: editImagePreviews[0] || product.image,
                                          sizes: editFormData.sizes
                                        })}
                                      >
                                        Salvar Alterações
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button 
                                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                      onClick={() => handleStockClick(product)}
                                    >
                                      Estoque
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>Atualizar Estoque</DialogTitle>
                                      <DialogDescription>
                                        Ajuste o estoque para "{product.name}"
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">
                                          Status Atual:
                                        </label>
                                        <span 
                                          className={`font-medium ${!product.in_stock ? "text-red-500" : "text-green-600"}`}
                                        >
                                          {product.in_stock ? 'Em Estoque' : 'Esgotado'}
                                        </span>
                                      </div>
                                      <div className="mt-4">
                                        <label className="text-sm font-medium block mb-2">
                                          Novo Estoque:
                                        </label>
                                        <Input 
                                          type="number" 
                                          value={newStockValue}
                                          onChange={(e) => setNewStockValue(Number(e.target.value))}
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button 
                                        variant="outline" 
                                        className="mr-2"
                                        onClick={() => {
                                          setEditingStockProduct(null);
                                          setNewStockValue(0);
                                        }}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button 
                                        className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                                        onClick={() => handleUpdateStock(product.id, newStockValue)}
                                      >
                                        Salvar
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>Remover Produto</DialogTitle>
                                      <DialogDescription>
                                        Tem certeza que deseja remover "{product.name}"? Esta ação não pode ser desfeita.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                      <Button variant="outline" className="mr-2">
                                        Cancelar
                                      </Button>
                                      <Button 
                                        variant="destructive"
                                        onClick={() => handleRemoveProduct(product.id)}
                                      >
                                        Remover
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-gray-500">
                              Nenhum produto encontrado com esses filtros.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Versão Mobile - Cards */}
                  <div className="block md:hidden space-y-3">
                    {filteredProducts.map((product) => (
                      <Card key={product.id} className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedItems.has(product.id)}
                            onCheckedChange={() => handleItemSelection(product.id)}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3 mb-3">
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm sm:text-base truncate">{product.name}</h3>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {product.category === 'camiseta' ? 'Camiseta' : product.category === 'vestido' ? 'Vestido' : product.category}
                                  </Badge>
                                  <span className={`text-xs py-1 px-2 rounded ${getStatusBadgeClass(product.status)}`}>
                                    {product.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm mb-3 pb-3 border-b">
                              <div>
                                <span className="text-gray-500 block mb-1">Preço:</span>
                                <p className="font-semibold text-base">R$ {product.price.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Estoque:</span>
                                <p className={`font-medium ${product.in_stock ? "text-green-600" : "text-red-500"}`}>
                                  {product.in_stock ? 'Em Estoque' : 'Esgotado'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1 text-xs sm:text-sm"
                                    onClick={() => handleEditClick(product)}
                                  >
                                    <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    Editar
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Editar Produto</DialogTitle>
                                    <DialogDescription>
                                      Altere os detalhes do produto.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                      <label htmlFor="edit-name" className="text-left sm:text-right text-sm font-medium">
                                        Nome
                                      </label>
                                      <Input 
                                        id="edit-name" 
                                        className="sm:col-span-3" 
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                      <label htmlFor="edit-description" className="text-left sm:text-right text-sm font-medium">
                                        Descrição
                                      </label>
                                      <Input 
                                        id="edit-description" 
                                        className="sm:col-span-3" 
                                        value={editFormData.description}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                      <label htmlFor="edit-category" className="text-left sm:text-right text-sm font-medium">
                                        Categoria
                                      </label>
                                      <Select 
                                        value={editFormData.category}
                                        onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value }))}
                                      >
                                        <SelectTrigger className="sm:col-span-3">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="camiseta">Camiseta</SelectItem>
                                          <SelectItem value="vestido">Vestido</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                      <label htmlFor="edit-price" className="text-left sm:text-right text-sm font-medium">
                                        Preço (R$)
                                      </label>
                                      <Input 
                                        id="edit-price" 
                                        className="sm:col-span-3" 
                                        type="number" 
                                        value={editFormData.price}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                                      <label className="text-left sm:text-right text-sm font-medium">
                                        Tamanhos
                                      </label>
                                      <div className="sm:col-span-3 space-y-2">
                                        <div className="flex flex-wrap gap-3">
                                          {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].map((size) => (
                                            <label key={size} className="flex items-center space-x-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={editFormData.sizes?.includes(size as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG') || false}
                                                onChange={(e) => {
                                                  const currentSizes = editFormData.sizes || [];
                                                  if (e.target.checked) {
                                                    setEditFormData(prev => ({
                                                      ...prev,
                                                      sizes: [...currentSizes, size as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XXG']
                                                    }));
                                                  } else {
                                                    setEditFormData(prev => ({
                                                      ...prev,
                                                      sizes: currentSizes.filter(s => s !== size)
                                                    }));
                                                  }
                                                }}
                                                className="rounded border-gray-300 text-butterfly-orange focus:ring-butterfly-orange"
                                              />
                                              <span className="text-sm font-medium">{size}</span>
                                            </label>
                                          ))}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          Selecione um ou mais tamanhos disponíveis para este produto
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                      <label className="text-left sm:text-right text-sm font-medium">
                                        Imagens
                                      </label>
                                      <div className="col-span-3 space-y-4">
                                        <div className="flex items-center gap-4">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById('edit-image-upload')?.click()}
                                            className="w-full"
                                          >
                                            <ImagePlus className="mr-2 h-4 w-4" />
                                            Alterar Imagens
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                          {editImagePreviews.length > 0 ? (
                                            editImagePreviews.map((preview, index) => (
                                              <div key={index} className="relative w-full h-32 rounded-md overflow-hidden border">
                                                <img
                                                  src={preview}
                                                  alt={`Imagem ${index + 1}`}
                                                  className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                                                  {index + 1}
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="col-span-full text-center text-gray-500 py-8">
                                              Nenhuma imagem selecionada
                                            </div>
                                          )}
                                        </div>
                                        {editImagePreviews.length > 0 && (
                                          <p className="text-xs text-gray-500">
                                            {editImagePreviews.length} imagem(ns) selecionada(s). A primeira será a imagem principal.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" className="mr-2" onClick={handleEditDialogClose}>
                                      Cancelar
                                    </Button>
                                    <Button 
                                      className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                                      onClick={() => handleUpdateProduct(product.id, {
                                        name: editFormData.name,
                                        description: editFormData.description,
                                        price: editFormData.price,
                                        category: editFormData.category as 'camiseta' | 'vestido',
                                        image: editImagePreviews[0] || product.image,
                                        sizes: editFormData.sizes
                                      })}
                                    >
                                      Salvar Alterações
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1 min-w-0"
                                    onClick={() => handleStockClick(product)}
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Estoque
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-[400px]">
                                  <DialogHeader>
                                    <DialogTitle>Atualizar Estoque</DialogTitle>
                                    <DialogDescription>
                                      Altere a quantidade em estoque do produto.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                      <label htmlFor="stock-quantity" className="text-right text-sm font-medium">
                                        Quantidade
                                      </label>
                                      <Input 
                                        id="stock-quantity" 
                                        className="col-span-3" 
                                        type="number" 
                                        value={stockFormData.quantity}
                                        onChange={(e) => setStockFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" className="mr-2" onClick={handleStockDialogClose}>
                                      Cancelar
                                    </Button>
                                    <Button 
                                      className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                                      onClick={() => handleUpdateStock(product.id, stockFormData.quantity)}
                                    >
                                      Atualizar Estoque
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-[400px]">
                                  <DialogHeader>
                                    <DialogTitle>Remover Produto</DialogTitle>
                                    <DialogDescription>
                                      Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline" className="mr-2" onClick={handleRemoveDialogClose}>
                                      Cancelar
                                    </Button>
                                    <Button 
                                      variant="destructive"
                                      onClick={() => handleConfirmRemove(product.id)}
                                    >
                                      Remover
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {filteredProducts.length === 0 && (
                      <Card className="p-8 text-center">
                        <p className="text-gray-500">Nenhum produto encontrado com esses filtros.</p>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="home">
              <HomeProductsManager />
            </TabsContent>
            
            <TabsContent value="estoque">
              <EstoqueContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Inputs de arquivo separados para upload de imagens */}
      <input
        type="file"
        id="create-image-upload"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        type="file"
        id="edit-image-upload"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleEditImageChange}
      />

      {/* Modal de Detalhes do Item de Roupa */}
      <Dialog open={!!selectedClothingItem} onOpenChange={() => setSelectedClothingItem(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Item</DialogTitle>
            <DialogDescription>Informações completas do item de roupa</DialogDescription>
          </DialogHeader>
          {selectedClothingItem && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Coluna Esquerda: Detalhes do Item */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Nome do Produto</p>
                    <p className="font-semibold text-gray-900">
                      {selectedClothingItem.products?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">ID do Item</p>
                    <p className="font-semibold text-gray-900 text-xs font-mono break-all">
                      {selectedClothingItem.id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Tamanho</p>
                    <p className="font-semibold text-gray-900">
                      {selectedClothingItem.size || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Quantidade</p>
                    <p className="font-semibold text-gray-900">
                      {selectedClothingItem.quantity || 1}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Preço Unitário</p>
                    <p className="font-semibold text-gray-900">
                      {(() => {
                        const itemPrice = normalizePrice(selectedClothingItem.total_price || selectedClothingItem.price || 0);
                        const unitPrice = selectedClothingItem.quantity > 0 ? itemPrice / selectedClothingItem.quantity : itemPrice;
                        return formatCurrency(unitPrice);
                      })()}
                    </p>
                  </div>
                </div>

                {/* Coluna Direita: Imagem do Produto */}
                <div className="flex justify-center items-start">
                  {selectedClothingItem.product_id && productImages[selectedClothingItem.product_id] ? (
                    <img
                      src={productImages[selectedClothingItem.product_id]}
                      alt={selectedClothingItem.products?.name || 'Produto'}
                      className="w-full max-w-[250px] h-auto object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-full max-w-[250px] aspect-square bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
                      <span className="text-gray-400">Imagem não disponível</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total do Item */}
              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-600">Total do Item</p>
                  <p className="font-semibold text-2xl text-green-600">
                    {(() => {
                      const itemPrice = normalizePrice(selectedClothingItem.total_price || selectedClothingItem.price || 0);
                      return formatCurrency(itemPrice);
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProdutos;

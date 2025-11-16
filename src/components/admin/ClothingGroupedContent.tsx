import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/formatCurrency';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { DetailsClothing } from '@/components/admin/DetailsClothing';
import { Skeleton } from '@/components/ui/skeleton';

export function ClothingGroupedContent({ clothingData, onSelectionChange, onOpenDetails, onOpenChangeStatus, onOpenChangeShipping, onOpenBarCode, onOpenChangePackage, onOpenDeleteClothing, onOpenDeletePackage }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [subItems, setSubItems] = useState([]);
    const [selectedSubItems, setSelectedSubItems] = useState([]);
    if (!clothingData) {
        return null;
    }

    const handleExpandClick = async () => {
        if (!isExpanded && clothingData.isPackage) {
            setIsLoading(true);
            try {
                const response = await api.get(`/clothing/package/${clothingData.id}`);
                setSubItems(response.data.subItems);
            } catch (error) {
                toast.error('Erro ao buscar os itens do pacote. Tente novamente.');
            } finally {
                setIsLoading(false);
            }
        }
        setIsExpanded(!isExpanded);
    };

    const handleSubItemSelectionChange = (subItemId, isSelected) => {
        const updatedSelection = isSelected
            ? [...selectedSubItems, subItemId]
            : selectedSubItems.filter((id) => id !== subItemId);
        setSelectedSubItems(updatedSelection);
        onSelectionChange(clothingData.id, isSelected, updatedSelection);
    };

    const handleMainCheckboxChange = (isSelected) => {
        const allSubItemIds = subItems.map(item => item.id);
        setSelectedSubItems(isSelected ? allSubItemIds : []);
        onSelectionChange(clothingData.id, isSelected, isSelected ? allSubItemIds : []);
    };

    useEffect(() => {
        if (!clothingData || !onSelectionChange) {
            return;
        }
        onSelectionChange(clothingData.id, selectedSubItems.length > 0, selectedSubItems);
    }, [selectedSubItems, clothingData, onSelectionChange]);

    const isMaster = clothingData.isMaster;
    const clothingItem = isMaster && clothingData.clothingItem ? clothingData.clothingItem : clothingData;

    return (
        <div className="border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Checkbox
                        checked={clothingData.isPackage ? selectedSubItems.length === subItems.length && subItems.length > 0 : clothingData.isSelected}
                        onCheckedChange={clothingData.isPackage ? handleMainCheckboxChange : (e) => onSelectionChange(clothingData.id, e.target.checked)}
                    />
                    {clothingData.isPackage && (
                        <Button variant="ghost" size="sm" onClick={handleExpandClick}>
                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                        </Button>
                    )}
                    <img src={clothingItem.images[0]?.url || '/placeholder.svg'} alt={clothingItem.name} className="w-16 h-16 object-cover rounded-md" />
                    <div>
                        <p className="font-semibold">{clothingItem.name}</p>
                        <p className="text-sm text-gray-500">Order ID: {clothingData.orderId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <p className="font-semibold">{clothingItem.user.name}</p>
                        <p className="text-sm text-gray-500">{clothingItem.user.email}</p>
                    </div>
                    <div className="text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${clothingData.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {clothingData.status}
                        </span>
                        <p className="text-sm text-gray-500">{format(new Date(clothingData.createdAt), 'dd/MM/yyyy, HH:mm')}</p>
                    </div>
                    <p className="font-semibold text-lg">{formatCurrency(clothingItem.price / 100)}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenDetails(clothingItem.id)}>Detalhes</Button>
                        <Button variant="outline" onClick={() => onOpenChangeStatus(clothingData.id)}>Status</Button>
                        <Button variant="outline" onClick={() => onOpenChangeShipping(clothingData.id)}>Envio</Button>
                        <Button variant="outline" onClick={() => onOpenBarCode(clothingData.id)}>Cód Barras</Button>
                        {clothingData.isPackage ? (
                            <>
                                <Button variant="outline" onClick={() => onOpenChangePackage(clothingData.id)}>Pacote</Button>
                                <Button variant="destructive" onClick={() => onOpenDeletePackage(clothingData.id)}>Excluir</Button>
                            </>
                        ) : (
                            <Button variant="destructive" onClick={() => onOpenDeleteClothing(clothingData.id)}>Excluir</Button>
                        )}
                    </div>
                </div>
            </div>
            {isExpanded && clothingData.isPackage && (
                <div className="mt-4 pl-12">
                    {isLoading ? (
                        <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    ) : (
                        subItems.map(subItem => (
                            <div key={subItem.id} className="flex items-center justify-between py-2 border-b">
                                <div className="flex items-center gap-4">
                                    <Checkbox
                                        checked={selectedSubItems.includes(subItem.id)}
                                        onCheckedChange={(isSelected) => handleSubItemSelectionChange(subItem.id, isSelected)}
                                    />
                                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-500 rounded-full">{subItem.quantity}</span>
                                    <img src={subItem.clothing.images[0]?.url || '/placeholder.svg'} alt={subItem.clothing.name} className="w-12 h-12 object-cover rounded-md" />
                                    <div>
                                        <p className="font-semibold">{subItem.clothing.name}</p>
                                        <p className="text-sm text-gray-500">Tamanho: {subItem.size} • Qtd: {subItem.quantity}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="font-semibold">{formatCurrency(subItem.price / 100)}</p>
                                        <p className="text-sm text-gray-500">Preço unitário</p>
                                    </div>
                                    <Button variant="ghost" onClick={() => onOpenDetails(subItem.clothing.id)}>Detalhes</Button>
                                    <p className="font-semibold text-lg">{formatCurrency((subItem.price / 100) * subItem.quantity)}</p>
                                </div>
                        








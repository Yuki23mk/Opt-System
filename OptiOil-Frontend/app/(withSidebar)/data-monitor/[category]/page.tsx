// app/(withSidebar)/data-monitor/[category]/page.tsx

"use client";
import html2pdf from "html2pdf.js";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Save, 
  Download, 
  Upload,
  Plus, 
  Settings, 
  Printer,
  FileText,
  AlertTriangle,
  X,
  Droplet,
  Trash2
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useConfirmModal } from "@/app/(withSidebar)/common/components/ConfirmModal";
import { ToastContainer, ToastItem } from "@/app/(withSidebar)/common/components/Toast";
import "chartjs-adapter-date-fns";
import { ENV } from '@/lib/env';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, TimeScale, Tooltip, Legend);

// 🆕 デフォルトテンプレート定義（最初に定義）
const fluidTemplates = {
  water_soluble_cutting: {
    name: "水溶性切削油",
    template: {
      equipmentId: "",
      equipmentName: "新規マシン",
      materialType: "水溶性切削油",
      selectedMaterialId: "",
      selectedMaterialName: "",
      displayRangeMin: 0,
      displayRangeMax: 20,
      phDisplayRangeMin: 6,
      phDisplayRangeMax: 12,
      concentrationAlertMin: 6.0,
      concentrationAlertMax: 9.0,
      phAlertMin: 8.0,
      phAlertMax: 10.0
    },
    color: "bg-[#115e59]",
    iconColor: "text-teal-600"
  // iconColor: "text-white"
  },
  water_soluble_grinding: {
    name: "水溶性研削油",
    template: {
      equipmentId: "",
      equipmentName: "新規マシン",
      materialType: "水溶性研削油",
      selectedMaterialId: "",
      selectedMaterialName: "",
      displayRangeMin: 0,
      displayRangeMax: 15,
      phDisplayRangeMin: 6,
      phDisplayRangeMax: 12,
      concentrationAlertMin: 3.0,
      concentrationAlertMax: 8.0,
      phAlertMin: 8.5,
      phAlertMax: 9.5
    },
    color: "bg-amber-500",
    iconColor: "text-amber-600"
  }
} as const;

// 🆕 FluidType の正規化関数を追加
const normalizeFluidType = (fluidType: string): keyof typeof fluidTemplates => {
  // データベースの古い値や不正な値を正規化
  const normalizedMap: Record<string, keyof typeof fluidTemplates> = {
    'water_soluble': 'water_soluble_cutting',
    'water_soluble_cutting': 'water_soluble_cutting',
    'water_soluble_grinding': 'water_soluble_grinding',
    'cutting_oil': 'water_soluble_cutting',
    'grinding_fluid': 'water_soluble_grinding'
  };
  
  return normalizedMap[fluidType] || 'water_soluble_cutting';
};

// 🆕 安全なfluidConfig取得関数
const getFluidConfig = (fluidType: string | undefined) => {
  const normalizedType = normalizeFluidType(fluidType || 'water_soluble_cutting');
  return fluidTemplates[normalizedType];
};

// 🆕 FluidType表示用の安全な関数
const getFluidTypeDisplay = (fluidType: string | undefined) => {
  const config = getFluidConfig(fluidType);
  return {
    name: config.name,
    color: config.color,
    iconColor: config.iconColor
  };
};

// セキュリティ関連のヘルパー関数を追加
const InputValidator = {
  containsDangerousChars: (input: string): boolean => {
    const dangerousPatterns = [
      /[<>'"`;\\]/g,
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b/gi,
      /--|\*\/|\*\s*\/|\/\*/,
      /<script|javascript:|data:|vbscript:/gi
    ];
    return dangerousPatterns.some(pattern => pattern.test(input));
  },

  sanitizeString: (input: string, maxLength: number = 255): string => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[<>'"`;\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  },

  validateProjectName: (name: string): { isValid: boolean; message?: string; sanitized?: string } => {
    if (!name || typeof name !== 'string') {
      return { isValid: false, message: 'プロジェクト名を入力してください' };
    }

    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      return { isValid: false, message: 'プロジェクト名を入力してください' };
    }

    if (trimmed.length > 100) {
      return { isValid: false, message: 'プロジェクト名は100文字以内で入力してください' };
    }

    if (InputValidator.containsDangerousChars(trimmed)) {
      return { isValid: false, message: '使用できない文字が含まれています' };
    }

    const sanitized = InputValidator.sanitizeString(trimmed, 100);
    
    if (sanitized.length === 0) {
      return { isValid: false, message: '有効な文字を入力してください' };
    }

    return { isValid: true, sanitized };
  }
};

const formatDate = (d: string | Date) => new Date(d).toISOString().split("T")[0];

// 🆕 日付フォーマット関数（年度分離対応）
const formatDateForTable = (dateStr: string) => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
};

const getYearFromDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.getFullYear();
};

// 🆕 年度を短縮形式で取得する関数
const getShortYearFromDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return `'${date.getFullYear().toString().slice(-2)}`;
};

const generateDefaultDates = (periodType: PeriodType) => {
  const dates = [];
  const today = new Date();
  const count = periodType === '10days' ? 10 : periodType === '1week' ? 7 : periodType === '1month' ? 30 : periodType === '3months' ? 90 : 365;
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// デバウンス関数
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

interface FluidManagementData {
  id?: number;
  date: string;
  values: Record<string, any>;
  note?: string;
}

interface ProjectConfig {
  equipmentId: string;
  equipmentName: string;
  materialType: string;
  selectedMaterialId?: string; // 🆕 選択された使用資材ID
  selectedMaterialName?: string; // 🆕 選択された使用資材名
  displayRangeMin: number;
  displayRangeMax: number;
  phDisplayRangeMin: number;
  phDisplayRangeMax: number;
  concentrationAlertMin: number;
  concentrationAlertMax: number;
  phAlertMin: number;
  phAlertMax: number;
}

interface ProjectWithTemplate {
  id: number;
  name: string;
  fluidType: 'water_soluble_cutting' | 'water_soluble_grinding';
  config: ProjectConfig;
  measurements: FluidManagementData[];
  measurementFields?: any[]; // 🆕 測定項目フィールド
}

type PeriodType = '10days' | '1week' | '1month' | '3months' | 'all';
type ChartViewType = 'concentration' | 'ph';

export default function CompleteDataMonitorPage() {
  const { category } = useParams();
  const [projects, setProjects] = useState<ProjectWithTemplate[]>([]);
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedFluidType, setSelectedFluidType] = useState<string>("");
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [hiddenCharts, setHiddenCharts] = useState<Record<number, boolean>>({}); // 🆕 グラフ表示状態管理
  const [customDates, setCustomDates] = useState<Record<number, string[]>>({});
  const [period, setPeriod] = useState<PeriodType>('10days');
  const [editingProject, setEditingProject] = useState<ProjectWithTemplate | null>(null);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [selectedEquipmentMaterials, setSelectedEquipmentMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loading, setLoading] = useState(false);

  // Toast管理
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  // 🆕 日付入力モーダル関連の状態
  const [showDateInputModal, setShowDateInputModal] = useState(false);
  const [selectedProjectForDate, setSelectedProjectForDate] = useState<number | null>(null);
  const [newDateInput, setNewDateInput] = useState('');
  const [isAddingDate, setIsAddingDate] = useState(false);
  
  // 🆕 日付編集モーダル関連の状態追加
  const [showDateEditModal, setShowDateEditModal] = useState(false);
  const [editingDateInfo, setEditingDateInfo] = useState<{
    projectId: number;
    dateIndex: number;
    currentDate: string;
  } | null>(null);
  const [newEditDate, setNewEditDate] = useState('');
  
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Toast関数
  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    const newToast: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      title,
      duration: 3000
    };
    setToasts(prev => [...prev, newToast]);

    // 3秒後に自動削除
    setTimeout(() => {
      removeToast(newToast.id);
    }, 3000);
  };

  const removeToast = (id: string | number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // グラフ表示切り替え状態
  const [chartViewType, setChartViewType] = useState<Record<number, ChartViewType>>({});

  // 🆕 プロジェクト単位のカスタム項目管理（プロジェクトDBから取得・保存）
  const [projectCustomItems, setProjectCustomItems] = useState<Record<number, string[]>>({});

  // 🆕 特定プロジェクトの測定項目をDBに保存する関数
  const saveMeasurementFieldsToProject = async (projectId: number, customItems: string[]) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // 🆕 測定項目配列を作成（固定項目 + カスタム項目）
      const measurementFields = [
        { key: "concentration", label: "濃度(%)", type: "number", required: true },
        { key: "ph", label: "pH", type: "number", required: true },
        ...customItems.map(item => ({
          key: item,
          label: item,
          type: "text",
          required: false
        }))
      ];

      // 🆕 特定プロジェクトの測定項目を更新
      const response = await fetch(`${ENV.API_URL}/api/data-monitor/project`, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          id: projectId,
          measurementFields: measurementFields
        })
      });

      if (response.ok) {
        console.log(`プロジェクト${projectId}の測定項目をDBに保存しました:`, measurementFields);
      } else {
        throw new Error('測定項目の保存に失敗しました');
      }
    } catch (error) {
      console.error('測定項目保存エラー:', error);
      throw error;
    }
  };

  // 🆕 プロジェクトごとの測定項目を復元する関数
  const loadCustomItemsFromProjects = (projectList: ProjectWithTemplate[]): Record<number, string[]> => {
    const projectItems: Record<number, string[]> = {};
    
    for (const project of projectList) {
      if (project.measurementFields && Array.isArray(project.measurementFields)) {
        const customFields = project.measurementFields
          .filter((field: any) => field.type === 'text' && !field.required)
          .map((field: any) => field.key);
        
        projectItems[project.id] = customFields.length > 0 
          ? customFields 
          : ['外観', '加工性', '工具摩耗', '消泡性', '防錆性', '備考']; // デフォルト項目
      } else {
        // デフォルト項目
        projectItems[project.id] = ['外観', '加工性', '工具摩耗', '消泡性', '防錆性', '備考'];
      }
    }

    return projectItems;
  };

  // プロジェクトフォーム状態
  const [projectForm, setProjectForm] = useState({
    name: '',
    equipmentId: '',
    equipmentName: '',
    materialType: '',
    selectedMaterialId: '', // 🆕 選択された使用資材ID
    selectedMaterialName: '', // 🆕 選択された使用資材名
    displayRangeMin: 0,
    displayRangeMax: 20,
    phDisplayRangeMin: 6,
    phDisplayRangeMax: 12,
    concentrationAlertMin: 5,
    concentrationAlertMax: 15,
    phAlertMin: 8.5,
    phAlertMax: 9.5
  });

  // 期間選択オプション（🆕 全期間追加）
  const periodOptions = [
    { value: '10days', label: '直近10日' },
    { value: '1week', label: '1週間' },
    { value: '1month', label: '1ヶ月' },
    { value: '3months', label: '3ヶ月' },
    { value: 'all', label: '全期間' }
  ];

  // 🆕 資材タイプの選択肢（カラー調整）
  const fluidTypes = [
    { value: "water_soluble_cutting", label: "水溶性切削油", color: "bg-[#115e59]", iconColor: "text-[#115e59]" },
    { value: "water_soluble_grinding", label: "水溶性研削油", color: "bg-amber-500", iconColor: "text-amber-600" }
  ];

  // 🆕 測定項目の定義（濃度に戻す）
  const fixedFields = [
    { key: 'concentration', label: '濃度(%)', type: 'number' },
    { key: 'ph', label: 'pH', type: 'number' }
  ];

  // APIリクエスト用のヘルパー関数
  const createAuthenticatedRequest = (method: string, body?: any) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("認証トークンが見つかりません");

    return {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Requested-With": "XMLHttpRequest",
      },
      ...(body && { body: JSON.stringify(body) })
    };
  };

  // 🆕 設備の使用資材を取得する関数
  const fetchEquipmentMaterials = async (equipmentId: string) => {
    if (!equipmentId) {
      setSelectedEquipmentMaterials([]);
      return;
    }

    setLoadingMaterials(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/api/equipments/${equipmentId}/materials`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
          "Cache-Control": "no-cache"
        }
      });

      if (response.ok) {
        const materials = await response.json();
        setSelectedEquipmentMaterials(materials);
        console.log("設備の使用資材取得成功:", materials.length, "件");
      } else {
        const errorData = await response.json();
        console.error("使用資材取得エラー:", errorData);
        setSelectedEquipmentMaterials([]);
        // エラーは表示しない（設備に資材が登録されていない場合があるため）
      }
    } catch (error) {
      console.error("使用資材取得失敗:", error);
      setSelectedEquipmentMaterials([]);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // 期間変更に対応したカスタムデート生成関数（🆕 全期間対応）
  const generateDatesByPeriod = useCallback((projectMeasurements: FluidManagementData[], currentPeriod: PeriodType) => {
    // 🆕 全期間の場合は既存データの全日付を使用
    if (currentPeriod === 'all') {
      const existingDates = projectMeasurements && projectMeasurements.length > 0 
        ? [...new Set(projectMeasurements.map(m => formatDate(m.date)))].sort()
        : [];
      
      if (existingDates.length === 0) {
        // データがない場合は直近10日を表示
        const today = new Date();
        const defaultDates: string[] = [];
        for (let i = 9; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          defaultDates.push(date.toISOString().split('T')[0]);
        }
        return defaultDates;
      }
      
      return existingDates;
    }
    
    const count = currentPeriod === '10days' ? 10 : currentPeriod === '1week' ? 7 : currentPeriod === '1month' ? 30 : 90;
    
    const existingDates = projectMeasurements && projectMeasurements.length > 0 
      ? [...new Set(projectMeasurements.map(m => formatDate(m.date)))].sort()
      : [];
    
    if (existingDates.length >= count) {
      const result = existingDates.slice(-count);
      return result;
    } else {
      const today = new Date();
      const additionalDates: string[] = [];
      
      for (let i = count - existingDates.length - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (!existingDates.includes(dateStr) && !additionalDates.includes(dateStr)) {
          additionalDates.push(dateStr);
        }
      }
      
      const allDates = [...existingDates, ...additionalDates].sort();
      const uniqueDates = [...new Set(allDates)];
      const result = uniqueDates.slice(-count);
      
      return result;
    }
  }, []);

  // 🆕 グラフ切り替えタブの選択肢（濃度に戻す）
  const chartViewOptions = [
    { value: 'concentration', label: '濃度' },
    { value: 'ph', label: 'pH' }
  ];

  // プロジェクトごとのグラフタイプを取得
  const getChartViewType = (projectId: number): ChartViewType => {
    return chartViewType[projectId] || 'concentration';
  };

  // グラフタイプ変更ハンドラー
  const handleChartViewChange = (projectId: number, viewType: ChartViewType) => {
    setChartViewType(prev => ({
      ...prev,
      [projectId]: viewType
    }));
  };

  // 🆕 グラフ表示/非表示ハンドラー
  const toggleChartVisibility = (projectId: number) => {
    setHiddenCharts(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // チャートデータ（切り替え対応）
  const memoizedChartData = useMemo(() => {
    const colors = ["#14b8a6", "#f59e0b", "#ef4444", "#537bc4", "#acc236", "#166a8f", "#00a950"];

    return projects.map(project => {
      const projectDates = customDates[project.id] || generateDatesByPeriod(project.measurements, period);
      const mergedMap = new Map<string, FluidManagementData>();
      
      for (const m of project.measurements || []) {
        const dateKey = formatDate(m.date);
        mergedMap.set(dateKey, m);
      }

      const currentViewType = getChartViewType(project.id);
      
      const datasets = [];
      
      // 濃度データセット
      if (currentViewType === 'concentration') {
        datasets.push({
          label: '濃度(%)',
          data: projectDates.map(date => {
            const measurement = mergedMap.get(date);
            return measurement?.values?.concentration || null;
          }),
          borderColor: colors[0],
          backgroundColor: colors[0] + '20',
          tension: 0.4,
          fill: false,
          spanGaps: true,
          yAxisID: 'y',
        });

        // 濃度正常範囲境界線（点線）
        datasets.push({
          label: '下限',
          data: new Array(projectDates.length).fill(project.config.concentrationAlertMin),
          borderColor: '#ef4444',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y',
        });

        datasets.push({
          label: '上限',
          data: new Array(projectDates.length).fill(project.config.concentrationAlertMax),
          borderColor: '#ef4444',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y',
        });
      }
      
      // pHデータセット
      if (currentViewType === 'ph') {
        datasets.push({
          label: 'pH',
          data: projectDates.map(date => {
            const measurement = mergedMap.get(date);
            return measurement?.values?.ph || null;
          }),
          borderColor: colors[1],
          backgroundColor: colors[1] + '20',
          tension: 0.4,
          fill: false,
          spanGaps: true,
          yAxisID: 'y',
        });

        // pH正常範囲境界線（点線）
        datasets.push({
          label: 'pH下限',
          data: new Array(projectDates.length).fill(project.config.phAlertMin),
          borderColor: '#ef4444',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y',
        });

        datasets.push({
          label: 'pH上限',
          data: new Array(projectDates.length).fill(project.config.phAlertMax),
          borderColor: '#ef4444',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y',
        });
      }
      
      return {
        labels: projectDates.map(date => {
          const shortDate = new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
          return `${shortDate}`;
        }),
        datasets
      };
    });
  }, [projects, customDates, period, generateDatesByPeriod, chartViewType]);

  // 🆕 グラフオプション（軸ラベル調整）
  const getChartOptions = useCallback((project: ProjectWithTemplate) => {
    const currentViewType = getChartViewType(project.id);
    
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: '測定日' },
        }
      },
      plugins: {
        legend: { 
          display: true,
          filter: (legendItem: any) => {
            return !legendItem.text?.includes('下限') && !legendItem.text?.includes('上限');
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          filter: (tooltipItem: any) => {
            return !tooltipItem.dataset.label?.includes('下限') && !tooltipItem.dataset.label?.includes('上限');
          },
          callbacks: {
            afterBody: function(context: any) {
              const lines: string[] = [];
              context.forEach((tooltipItem: any) => {
                if (tooltipItem.dataset.label === '濃度(%)') {
                  const value = tooltipItem.parsed.y;
                  if (value < project.config.concentrationAlertMin || value > project.config.concentrationAlertMax) {
                    lines.push('⚠️ 濃度が正常範囲外');
                  }
                } else if (tooltipItem.dataset.label === 'pH') {
                  const value = tooltipItem.parsed.y;
                  if (value < project.config.phAlertMin || value > project.config.phAlertMax) {
                    lines.push('⚠️ pHが正常範囲外');
                  }
                }
              });
              return lines;
            }
          }
        },
      },
    };

    // スケール設定
    if (currentViewType === 'concentration') {
      baseOptions.scales.y = {
        type: 'linear' as const,
        title: { display: true, text: '濃度(%)' },
        min: project.config.displayRangeMin,
        max: project.config.displayRangeMax,
      };
    } else if (currentViewType === 'ph') {
      baseOptions.scales.y = {
        type: 'linear' as const,
        title: { display: true, text: 'pH' },
        min: project.config.phDisplayRangeMin || 6,
        max: project.config.phDisplayRangeMax || 12,
      };
    }

    return baseOptions;
  }, [chartViewType]);

  useEffect(() => {
    const initializeData = async () => {
      if (!category || loading) return;
      
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          addToast('認証トークンが見つかりません。ログインしてください。', 'error');
          return;
        }

        // カテゴリ情報を必須で取得
        const categoryRes = await fetch(`${ENV.API_URL}/api/data-monitor/category?id=${encodeURIComponent(category as string)}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "X-Requested-With": "XMLHttpRequest",
             "Cache-Control": "no-cache"
          }
        });
        
        if (!categoryRes.ok) {
          const categoryError = await categoryRes.json();
          addToast('カテゴリ情報の取得に失敗しました。URLを確認してください。', 'error');
          return;
        }

        const categoryData = await categoryRes.json();
        setCurrentCategoryId(categoryData.id);
        setCategoryLabel(categoryData.name);
            
        // プロジェクト一覧を取得（measurementsを含む）
        const projectRes = await fetch(`${ENV.API_URL}/api/data-monitor/project?categoryId=${categoryData.id}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "X-Requested-With": "XMLHttpRequest",
             "Cache-Control": "no-cache"
          }
        });
        
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          
          const convertedProjects = projectData.map((p: any) => {
            // 🔧 デバッグ用ログ追加
            console.log(`Project ${p.id}: original fluidType = "${p.fluidType}"`);
            const normalizedFluidType = normalizeFluidType(p.fluidType || 'water_soluble_cutting');
            console.log(`Project ${p.id}: normalized fluidType = "${normalizedFluidType}"`);
            
            return {
              ...p,
              fluidType: normalizedFluidType, // 🔧 正規化を追加
              config: p.limitSettings || fluidTemplates.water_soluble_cutting.template,
              measurements: p.measurements || [],
              measurementFields: p.measurementFields || null // 🆕 測定項目を保持
            };
          });          
          // 🆕 プロジェクトのデフォルトテンプレートを適用
          setProjects(convertedProjects);

          // 🆕 プロジェクトごとの測定項目を復元
          const loadedProjectItems = loadCustomItemsFromProjects(convertedProjects);
          setProjectCustomItems(loadedProjectItems);

          // 測定データから日付を正しく設定
          const dateMap: Record<number, string[]> = {};
          const chartViewMap: Record<number, ChartViewType> = {};
          const hiddenChartMap: Record<number, boolean> = {}; // 🆕 デフォルト表示状態
          for (const p of convertedProjects) {
            dateMap[p.id] = generateDatesByPeriod(p.measurements || [], period);
            chartViewMap[p.id] = 'concentration';
            hiddenChartMap[p.id] = false; // 🆕 デフォルトで表示
          }
          setCustomDates(dateMap);
          setChartViewType(chartViewMap);
          setHiddenCharts(hiddenChartMap); // 🆕 グラフ表示状態設定
          console.log("初期日付設定完了:", dateMap);
        } else {
          const projectError = await projectRes.json();
          addToast(`プロジェクト取得失敗: ${projectError.error}`, 'error');
        }

        // 設備一覧を取得
        try {
          const equipmentRes = await fetch(`${ENV.API_URL}/api/equipments`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "X-Requested-With": "XMLHttpRequest",
              "Cache-Control": "no-cache"
            }
          });
          
          if (equipmentRes.ok) {
            const equipmentData = await equipmentRes.json();
            if (Array.isArray(equipmentData)) {
              setEquipmentList(equipmentData);
            } else {
              setEquipmentList([]);
            }
          } else {
            setEquipmentList([]);
          }
        } catch (error) {
          setEquipmentList([]);
        }
          
      } catch (error) {
        addToast('初期化に失敗しました。コンソールを確認してください。', 'error');
        setCategoryLabel(category as string);
        setCurrentCategoryId(1);
        setEquipmentList([]);
        
        // 🆕 エラー時もデフォルトカスタム項目を設定
        setProjectCustomItems({});
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [category]);

  // 期間変更時にデータ範囲を更新
  useEffect(() => {
    if (projects.length === 0) {
      return;
    }
    
    setCustomDates(prev => {
      return {};
    });
    
    setTimeout(() => {
      setCustomDates(prev => {
        const newDates: Record<number, string[]> = {};
        
        for (const project of projects) {
          const generatedDates = generateDatesByPeriod(project.measurements || [], period);
          newDates[project.id] = generatedDates;
        }
        
        return newDates;
      });
    }, 100);
  }, [period, projects, generateDatesByPeriod]);

  const openProjectModal = (project?: ProjectWithTemplate) => {
    if (project) {
      setEditingProject(project);
      setProjectForm({
        name: project.name,
        equipmentId: project.config.equipmentId || '',
        equipmentName: project.config.equipmentName || '',
        materialType: project.config.materialType || '',
        selectedMaterialId: project.config.selectedMaterialId || '',
        selectedMaterialName: project.config.selectedMaterialName || '',
        displayRangeMin: project.config.displayRangeMin || 0,
        displayRangeMax: project.config.displayRangeMax || 20,
        phDisplayRangeMin: project.config.phDisplayRangeMin || 6,
        phDisplayRangeMax: project.config.phDisplayRangeMax || 12,
        concentrationAlertMin: project.config.concentrationAlertMin || 5,
        concentrationAlertMax: project.config.concentrationAlertMax || 15,
        phAlertMin: project.config.phAlertMin || 8.5,
        phAlertMax: project.config.phAlertMax || 9.5
      });
      // 🆕 編集時は既存の設備の使用資材を取得
      if (project.config.equipmentId) {
        fetchEquipmentMaterials(project.config.equipmentId);
      }
    } else {
      setEditingProject(null);
      setProjectForm({
        name: '',
        equipmentId: '',
        equipmentName: '',
        materialType: '',
        selectedMaterialId: '',
        selectedMaterialName: '',
        displayRangeMin: 0,
        displayRangeMax: 20,
        phDisplayRangeMin: 6,
        phDisplayRangeMax: 12,
        concentrationAlertMin: 5,
        concentrationAlertMax: 15,
        phAlertMin: 8.5,
        phAlertMax: 9.5
      });
      setSelectedEquipmentMaterials([]);
    }
    setShowProjectModal(true);
  };

  const createProject = async () => {
    if (!selectedFluidType) {
      addToast("資材タイプを選択してください", 'warning');
      return;
    }
    
    const nameValidation = InputValidator.validateProjectName(projectForm.name);
    if (!nameValidation.isValid) {
      addToast(nameValidation.message || "プロジェクト名が無効です", 'warning');
      return;
    }

    if (!currentCategoryId) {
      addToast("カテゴリ情報の取得に失敗しました。ページを再読み込みしてください。", 'error');
      return;
    }

    const fluidConfig = fluidTemplates[selectedFluidType as keyof typeof fluidTemplates] || fluidTemplates.water_soluble_cutting;

    // 設備情報の処理を改善
    const selectedEquipment = equipmentList.find(eq => eq.id === projectForm.equipmentId || eq.id.toString() === projectForm.equipmentId);
    const finalConfig = {
      ...fluidConfig.template,
      ...projectForm,
      equipmentName: selectedEquipment?.name || projectForm.equipmentName || "未設定"
    };

    try {
      const res = await fetch(`${ENV.API_URL}/api/data-monitor/project`, createAuthenticatedRequest("POST", {
        name: nameValidation.sanitized,
        categoryId: currentCategoryId,
        fluidType: selectedFluidType,
        config: finalConfig
        // measurementFieldsはAPI側でデフォルト設定される
      }));

      if (res.ok) {
        const created = await res.json();
        
        const newProject: ProjectWithTemplate = {
          id: created.id,
          name: created.name,
          fluidType: selectedFluidType as any,
          config: finalConfig,
          measurements: [],
          measurementFields: created.measurementFields || null // 🆕 測定項目を保持
        };
        
        setProjects([...projects, newProject]);
        setCustomDates(prev => ({
          ...prev,
          [created.id]: generateDatesByPeriod([], period)
        }));
        
        setChartViewType(prev => ({
          ...prev,
          [created.id]: 'concentration'
        }));

        // 🆕 新プロジェクトのグラフもデフォルトで表示
        setHiddenCharts(prev => ({
          ...prev,
          [created.id]: false
        }));

        // 🆕 新規プロジェクトにデフォルト測定項目を設定
        const defaultItems = ['外観', '加工性', '工具摩耗', '消泡性', '防錆性', '備考'];
        setProjectCustomItems(prev => ({
          ...prev,
          [created.id]: defaultItems
        }));
        
        resetForm();
        addToast("データベースにプロジェクトを作成しました", 'success');
      } else {
        const errorData = await res.json();
        addToast(`プロジェクト作成失敗: ${errorData.error}`, 'error');
        return;
      }
    } catch (error) {
      addToast("プロジェクト作成に失敗しました。ネットワーク接続を確認してください。", 'error');
      return;
    }
  };

  // フォームリセット用のヘルパー関数
  const resetForm = () => {
    setShowProjectCreation(false);
    setShowProjectModal(false);
    setSelectedFluidType("");
    setSelectedEquipmentMaterials([]);
    setProjectForm({
      name: '',
      equipmentId: '',
      equipmentName: '',
      materialType: '',
      selectedMaterialId: '',
      selectedMaterialName: '',
      displayRangeMin: 0,
      displayRangeMax: 20,
      phDisplayRangeMin: 6,
      phDisplayRangeMax: 12,
      concentrationAlertMin: 5,
      concentrationAlertMax: 15,
      phAlertMin: 8.5,
      phAlertMax: 9.5
    });
  };

  const saveProject = async () => {
    const nameValidation = InputValidator.validateProjectName(projectForm.name);
    if (!nameValidation.isValid) {
      addToast(nameValidation.message || "プロジェクト名が無効です", 'warning');
      return;
    }

    if (nameValidation.sanitized.length > 100) {
      addToast("プロジェクト名は100文字以内で入力してください", 'warning');
      return;
    }

    try {
      if (editingProject) {
        const res = await fetch(`${ENV.API_URL}/api/data-monitor/project`, createAuthenticatedRequest("PUT", {
          id: editingProject.id,
          name: nameValidation.sanitized,
          limitSettings: projectForm
        }));

        if (res.ok) {
          const updatedData = await res.json();

          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === editingProject.id
                ? {
                    ...p,
                    name: nameValidation.sanitized,
                    config: {
                      ...p.config,
                      ...projectForm
                    }
                  }
                : p
            )
          );
          
          addToast("データベースにプロジェクトを更新しました", 'success');
        } else {
          const errorData = await res.json();
          addToast(`プロジェクト更新失敗: ${errorData.error || 'Unknown error'}`, 'error');
          throw new Error(`API Error: ${res.status} - ${errorData.error}`);
        }
      } else {
        await createProject();
        return;
      }
    } catch (error) {
      addToast("プロジェクト保存に失敗しました。コンソールを確認してください。", 'error');
      return;
    }

    setShowProjectModal(false);
    setEditingProject(null);
    resetForm();
  };

  // 共有コンポーネント使用（削除確認）
  const { openConfirm } = useConfirmModal();

  const confirmDeleteProject = (project: ProjectWithTemplate) => {
    openConfirm({
      title: 'プロジェクト削除',
      message: `「${project.name}」を削除しますか？\n※ 関連する測定データもすべて削除されます`,
      type: 'danger',
      confirmText: '削除実行',
      onConfirm: () => deleteProject(project)
    });
  };

  const deleteProject = async (project: ProjectWithTemplate) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const res = await fetch(`${ENV.API_URL}/api/data-monitor/project?id=${project.id}`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
           "Cache-Control": "no-cache"
        },
      });

      if (res.ok) {
        const updatedProjects = projects.filter(p => p.id !== project.id);
        setProjects(updatedProjects);
        
        const newCustomDates = { ...customDates };
        delete newCustomDates[project.id];
        setCustomDates(newCustomDates);
        
        // グラフタイプからも削除
        setChartViewType(prev => {
          const updated = { ...prev };
          delete updated[project.id];
          return updated;
        });

        // 🆕 グラフ表示状態からも削除
        setHiddenCharts(prev => {
          const updated = { ...prev };
          delete updated[project.id];
          return updated;
        });

        // 🆕 プロジェクト測定項目からも削除
        setProjectCustomItems(prev => {
          const updated = { ...prev };
          delete updated[project.id];
          return updated;
        });
        
        addToast("データベースからプロジェクトを削除しました", 'success');
      } else {
        const errorData = await res.json();
        addToast(`プロジェクト削除失敗: ${errorData.error || 'Unknown error'}`, 'error');
        throw new Error(`API Error: ${res.status} - ${errorData.error}`);
      }
    } catch (error) {
      addToast("プロジェクト削除に失敗しました。コンソールを確認してください。", 'error');
    }
  };

  // セル編集機能（リロードなし）
  const handleCellClick = (projectId: number, date: string, field: string, currentValue: any) => {
    if (editingCell) {
      return;
    }
    
    const cellKey = `${projectId}_${date}_${field}`;
    setEditingCell(cellKey);
    setTempValue(currentValue?.toString() || "");
  };

  // デバウンス付きセル保存
  const debouncedCellSave = useCallback(
    debounce(async (projectId: number, date: string, field: string, value: string) => {
      await handleCellSave(projectId, date, field, value);
    }, 300),
    []
  );

  const handleCellSave = async (projectId: number, date: string, field: string, inputValue?: string) => {
    const valueToSave = inputValue !== undefined ? inputValue : tempValue;
    
    if (!valueToSave || valueToSave.trim() === '') {
      setEditingCell(null);
      return;
    }
    
    try {
      let value: any;
      if (field === 'concentration' || field === 'ph') {
        const numValue = parseFloat(valueToSave);
        if (isNaN(numValue)) {
          setEditingCell(null);
          return;
        }
        value = numValue;
        
        if (value < -1000 || value > 1000) {
          addToast("値が範囲外です（-1000 ~ 1000）", 'warning');
          setEditingCell(null);
          return;
        }
      } else {
        if (InputValidator.containsDangerousChars(valueToSave)) {
          addToast("使用できない文字が含まれています", 'warning');
          setEditingCell(null);
          return;
        }
        value = InputValidator.sanitizeString(valueToSave, 500);
        
        if (!value || value.trim() === '') {
          setEditingCell(null);
          return;
        }
      }

      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        setEditingCell(null);
        return;
      }

      // 既存データを確認
      const existingRes = await fetch(`${ENV.API_URL}/api/data-monitor/measurement?projectId=${projectId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
           "Cache-Control": "no-cache"
        }
      });

      let existingMeasurement = null;
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        existingMeasurement = existingData.find((m: any) => formatDate(m.date) === date);
      }

      // 既存のvaluesに新しい値をマージ
      const existingValues = existingMeasurement?.values || {};
      const updatedValues = { ...existingValues, [field]: value };

      let res;
      if (existingMeasurement) {
        res = await fetch(`${ENV.API_URL}/api/data-monitor/measurement`, createAuthenticatedRequest("PUT", {
          id: existingMeasurement.id,
          values: updatedValues,
          note: existingMeasurement.note
        }));
      } else {
        res = await fetch(`${ENV.API_URL}/api/data-monitor/measurement`, createAuthenticatedRequest("POST", {
          projectId,
          date,
          values: updatedValues,
          note: undefined
        }));
      }

      if (res.ok) {
        const savedData = await res.json();

        // ローカル状態を更新
        setProjects(prevProjects => 
          prevProjects.map(proj => {
            if (proj.id === projectId) {
              const measurementIndex = proj.measurements.findIndex(m => formatDate(m.date) === date);
              if (measurementIndex >= 0) {
                proj.measurements[measurementIndex] = {
                  ...proj.measurements[measurementIndex],
                  values: updatedValues
                };
              } else {
                proj.measurements.push({
                  id: savedData.id,
                  date: new Date(date).toISOString(),
                  values: updatedValues,
                  note: undefined
                });
              }
            }
            return proj;
          })
        );

        addToast("データベースに保存しました", 'success');
      } else {
        const errorData = await res.json();
        addToast(`データベース保存エラー: ${errorData.error}`, 'error');
        throw new Error(`API Error: ${res.status}`);
      }
      
    } catch (error) {
      addToast("データ保存に失敗しました。コンソールを確認してください。", 'error');
    } finally {
      setEditingCell(null);
    }
  };

// 🆕 日付編集開始ハンドラー
const handleDateEditStart = (projectId: number, dateIndex: number, currentDate: string) => {
  setEditingDateInfo({ projectId, dateIndex, currentDate });
  setNewEditDate(currentDate);
  setShowDateEditModal(true);
};

// 🆕 日付編集保存ハンドラー
const handleDateEditSave = () => {
  if (!editingDateInfo || !newEditDate.trim()) {
    addToast("日付を入力してください", 'warning');
    return;
  }

  if (!newEditDate || isNaN(Date.parse(newEditDate))) {
    addToast("有効な日付を入力してください", 'warning');
    return;
  }

  const { projectId, dateIndex } = editingDateInfo;
  
  setCustomDates(prev => {
    const currentDates = prev[projectId] || [];
    
    const otherDates = currentDates.filter((_, i) => i !== dateIndex);
    if (otherDates.includes(newEditDate)) {
      addToast("その日付は既に存在します", 'warning');
      return prev;
    }
    
    const updatedDates = currentDates.map((date, i) => i === dateIndex ? newEditDate : date);
    const count = period === '10days' ? 10 : period === '1week' ? 7 : period === '1month' ? 30 : period === '3months' ? 90 : 365;
    
    const uniqueDates = [...new Set(updatedDates)].sort();
    const limitedDates = period === 'all' ? uniqueDates : uniqueDates.slice(-count);
    
    return {
      ...prev,
      [projectId]: limitedDates
    };
  });
  
  setShowDateEditModal(false);
  setEditingDateInfo(null);
  setNewEditDate('');
  addToast("日付を更新しました", 'success');
};

  // 🆕 期間内日付バリデーション関数
  const validateDateInPeriod = (inputDate: string, projectId: number): { isValid: boolean; message?: string } => {
    const currentDates = customDates[projectId] || [];
    
    // 日付形式チェック
    if (!inputDate || isNaN(Date.parse(inputDate))) {
      return { isValid: false, message: '有効な日付を入力してください' };
    }
    
    const targetDate = new Date(inputDate);
    const today = new Date();
    
    // 未来日チェック
    if (targetDate > today) {
      return { isValid: false, message: '未来の日付は入力できません' };
    }
    
    // 🆕 全期間の場合は範囲チェックをスキップ
    if (period !== 'all') {
      const count = period === '10days' ? 10 : period === '1week' ? 7 : period === '1month' ? 30 : 90;
      
      // 表示期間内かチェック
      const periodStartDate = new Date(today);
      periodStartDate.setDate(today.getDate() - (count - 1));
      
      if (targetDate < periodStartDate) {
        return { 
          isValid: false, 
          message: `表示期間外です。表示期間（${periodOptions.find(opt => opt.value === period)?.label}）に合わせた日付を入力してください` 
        };
      }
    }
    
    // 重複チェック
    if (currentDates.includes(inputDate)) {
      return { isValid: false, message: 'その日付は既に存在します' };
    }
    
    return { isValid: true };
  };

  // 🆕 日付保存処理
  const handleSaveDateInput = async () => {
    if (!selectedProjectForDate || !newDateInput.trim()) {
      addToast("日付を入力してください", 'warning');
      return;
    }

    const validation = validateDateInPeriod(newDateInput, selectedProjectForDate);
    if (!validation.isValid) {
      addToast(validation.message || "無効な日付です", 'warning');
      return;
    }

    setIsAddingDate(true);
    
    try {
      setCustomDates(prev => {
        const currentDates = prev[selectedProjectForDate] || [];
        const count = period === '10days' ? 10 : period === '1week' ? 7 : period === '1month' ? 30 : period === '3months' ? 90 : 365;
        
        const updatedDates = [...currentDates, newDateInput].sort();
        const limitedDates = period === 'all' ? updatedDates : updatedDates.slice(-count);
        
        return {
          ...prev,
          [selectedProjectForDate]: limitedDates
        };
      });
      
      setShowDateInputModal(false);
      setNewDateInput('');
      setSelectedProjectForDate(null);
      addToast("日付を追加しました", 'success');
    } catch (error) {
      addToast("日付の追加に失敗しました", 'error');
    } finally {
      setIsAddingDate(false);
    }
  };

  const addNewDate = (projectId: number) => {
    setSelectedProjectForDate(projectId);
    setShowDateInputModal(true);
    // デフォルトで今日の日付を設定
    setNewDateInput(new Date().toISOString().split('T')[0]);
  };

  // カスタム項目操作
  const [selectedProjectForItem, setSelectedProjectForItem] = useState<number | null>(null);
  
  const handleAddCustomItem = (projectId: number) => {
    setSelectedProjectForItem(projectId);
    setShowAddItemModal(true);
    setNewItemName('');
  };

  // 🆕 カスタム項目追加処理（特定プロジェクト対応）
  const handleSaveNewItem = async () => {
    if (!newItemName.trim() || !selectedProjectForItem) {
      addToast("項目名を入力してください", 'warning');
      return;
    }

    const trimmedItem = newItemName.trim();
    if (trimmedItem.length > 50) {
      addToast("項目名は50文字以内で入力してください", 'warning');
      return;
    }

    const currentItems = projectCustomItems[selectedProjectForItem] || [];
    if (currentItems.includes(trimmedItem)) {
      addToast("その項目は既に存在します", 'warning');
      return;
    }

    setIsAddingItem(true);
    
    try {
      const newItems = [...currentItems, trimmedItem];
      
      // 🆕 特定プロジェクトの測定項目をDBに保存
      await saveMeasurementFieldsToProject(selectedProjectForItem, newItems);
      
      // ローカル状態を更新
      setProjectCustomItems(prev => ({
        ...prev,
        [selectedProjectForItem]: newItems
      }));
      
      setShowAddItemModal(false);
      setNewItemName('');
      setSelectedProjectForItem(null);
      addToast(`「${trimmedItem}」を追加しました`, 'success');
    } catch (error) {
      addToast("項目の追加に失敗しました", 'error');
    } finally {
      setIsAddingItem(false);
    }
  };

  // 🆕 カスタム項目削除処理（特定プロジェクト対応）
  const handleRemoveCustomItem = (projectId: number, item: string) => {
    openConfirm({
      title: '項目削除',
      message: `「${item}」を削除しますか？関連するデータも失われます。`,
      type: 'warning',
      confirmText: '削除',
      onConfirm: async () => {
        try {
          const currentItems = projectCustomItems[projectId] || [];
          const newItems = currentItems.filter(i => i !== item);
          
          // 🆕 特定プロジェクトの測定項目をDBに保存
          await saveMeasurementFieldsToProject(projectId, newItems);
          
          // ローカル状態を更新
          setProjectCustomItems(prev => ({
            ...prev,
            [projectId]: newItems
          }));
          
          addToast(`「${item}」を削除しました`, 'success');
        } catch (error) {
          addToast("項目の削除に失敗しました", 'error');
        }
      }
    });
  };

  // CSV出力（Excel対応版）
  const downloadCSV = (project: ProjectWithTemplate) => {
    const projectDates = customDates[project.id] || generateDatesByPeriod(project.measurements, period);
    const projectItems = projectCustomItems[project.id] || [];
    let csv = "項目," + projectDates.join(",") + "\n";

    for (const field of fixedFields) {
      const row = [field.label];
      for (const date of projectDates) {
        const measurement = project.measurements.find(m => formatDate(m.date) === date);
        const value = measurement?.values?.[field.key];
        row.push(value?.toString() || "");
      }
      csv += row.join(",") + "\n";
    }

    for (const item of projectItems) {
      const row = [item];
      for (const date of projectDates) {
        const measurement = project.measurements.find(m => formatDate(m.date) === date);
        const value = measurement?.values?.[item];
        row.push(value?.toString() || "");
      }
      csv += row.join(",") + "\n";
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${project.name}_記録表.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 🆕 印刷機能（グラフ表示状態対応・改善版ページ分割）
  const handlePrint = (projectId: number, projectName: string) => {
    const tableEl = document.getElementById(`proj-${projectId}-table`);
    const chartEl = document.getElementById(`proj-${projectId}-chart`);
    const isChartVisible = !hiddenCharts[projectId]; // 🆕 グラフ表示状態チェック
    
    if (!tableEl) return;

    const projectDates = customDates[projectId] || generateDatesByPeriod(projects.find(p => p.id === projectId)?.measurements || [], period);
    
    // テーブルの複製を作成（項目追加ボタンを除去）
    const clonedTable = tableEl.cloneNode(true) as HTMLElement;
    
    // ×ボタンと項目追加ボタンを除去
    const removeButtons = clonedTable.querySelectorAll('.remove-item-btn');
    removeButtons.forEach(btn => btn.remove());
    
    const addButtons = clonedTable.querySelectorAll('button:has(.w-4.h-4)');
    addButtons.forEach(btn => {
      const parent = btn.closest('td, th');
      if (parent) parent.remove();
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast("ポップアップがブロックされました。ポップアップを許可してください。", 'warning');
      return;
    }

    // 🆕 データ数とグラフ表示に応じた印刷スタイル
    const isWideData = projectDates.length > 15;
    const orientation = isWideData ? 'landscape' : 'portrait';
    const columnsPerPage = isWideData ? 20 : 10; // 🆕 ページあたりの列数

    // 🆕 テーブルをページごとに分割
    const splitTableByColumns = (table: HTMLElement, maxColumns: number) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const headerRow = rows[0];
      const years = [...new Set(projectDates.map(date => getYearFromDate(date)))];
      const yearRow = years.length > 1 ? rows[1] : null;
      const dataRows = yearRow ? rows.slice(2) : rows.slice(1);
      
      const totalColumns = projectDates.length;
      const pageCount = Math.ceil(totalColumns / maxColumns);
      const pages = [];

      for (let page = 0; page < pageCount; page++) {
        const startCol = page * maxColumns;
        const endCol = Math.min(startCol + maxColumns, totalColumns);
        
        let pageHtml = '<table class="w-full text-sm border-collapse border border-slate-300 mb-20">';
        
        // ヘッダー行
        const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
        pageHtml += '<thead><tr class="bg-slate-100">';
        pageHtml += headerCells[0].outerHTML; // 測定項目列
        for (let i = startCol; i < endCol; i++) {
          pageHtml += headerCells[i + 1]?.outerHTML || '';
        }
        pageHtml += '</tr>';
        
        // 年度行（必要な場合）
        if (yearRow) {
          const yearCells = Array.from(yearRow.querySelectorAll('th, td'));
          pageHtml += '<tr class="year-header">';
          pageHtml += yearCells[0].outerHTML; // 年度列
          for (let i = startCol; i < endCol; i++) {
            pageHtml += yearCells[i + 1]?.outerHTML || '';
          }
          pageHtml += '</tr>';
        }
        
        pageHtml += '</thead><tbody>';
        
        // データ行
        for (const row of dataRows) {
          const cells = Array.from(row.querySelectorAll('th, td'));
          pageHtml += '<tr>';
          pageHtml += cells[0].outerHTML; // 測定項目列
          for (let i = startCol; i < endCol; i++) {
            pageHtml += cells[i + 1]?.outerHTML || '';
          }
          pageHtml += '</tr>';
        }
        
        pageHtml += '</tbody></table>';
        pages.push(pageHtml);
      }
      
      return pages.join('');
    };

    // グラフの処理
    let chartHtml = '';
    if (isChartVisible && chartEl) {
      // グラフのCanvas要素を画像として取得
      const canvas = chartEl.querySelector('canvas');
      if (canvas) {
        try {
          const dataURL = canvas.toDataURL('image/png', 1.0);
          chartHtml = `<div class="chart-container"><img src="${dataURL}" style="max-width: 100%; height: auto;" alt="推移グラフ" /></div>`;
        } catch (error) {
          console.error('グラフの画像変換に失敗:', error);
          chartHtml = '<div class="chart-container"><p>グラフの印刷に失敗しました</p></div>';
        }
      }
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${projectName}_記録表</title>
          <style>
            @page { 
              size: A4 ${orientation}; 
              margin: 10mm; 
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: ${isWideData ? '8px' : '10px'};
              line-height: 1.1;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-bottom: 20px;
              table-layout: ${isWideData ? 'fixed' : 'auto'};
              break-inside: avoid;
            }
            th, td { 
              border: 1px solid #333; 
              padding: ${isWideData ? '1px' : '2px'}; 
              text-align: center; 
              word-wrap: break-word;
              overflow: hidden;
              font-size: ${isWideData ? '7px' : '9px'};
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
            }
            .year-header th {
              background-color: #e0e0e0;
              font-size: ${isWideData ? '6px' : '8px'};
            }
            .chart-container { 
              margin: 20px 0; 
              page-break-inside: avoid; 
              max-height: 300px;
              text-align: center;
            }
            .chart-container img {
              max-width: 100%;
              height: auto;
            }
            button { 
              display: none !important; 
            }
            .no-print {
              display: none !important;
            }
            h2 {
              font-size: 16px;
              margin-bottom: 10px;
              page-break-after: avoid;
            }
            @media print {
              .chart-container { 
                page-break-inside: avoid; 
              }
              button { 
                display: none !important; 
              }
              .no-print {
                display: none !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          <h2>${projectName} - 測定記録表</h2>
          ${chartHtml}
          ${splitTableByColumns(clonedTable, columnsPerPage)}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // 画像の読み込みを待って印刷
    if (chartHtml.includes('<img')) {
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    } else {
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#115e59]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* ヘッダー - カテゴリ名のみ表示 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            {categoryLabel}
          </h1>
        </div>
        <Button 
          onClick={() => setShowProjectCreation(true)} 
          className="bg-[#115e59] hover:bg-[#0f766e] text-white h-8 text-xs px-3 py-1 w-full sm:w-auto"
          disabled={loading}
        >
          <Plus className="w-4 h-4 mr-1" />
          新しいプロジェクト
        </Button>
      </div>

      {/* プロジェクト作成パネル */}
      {showProjectCreation && (
        <Card className="mb-4 border-[#115e59] bg-slate-50">
          <CardHeader className="p-3">
            <CardTitle className="text-[#115e59] text-xs sm:text-sm">新しいプロジェクトを作成</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(fluidTemplates).map(([key, config]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedFluidType === key
                      ? 'border-[#115e59] bg-slate-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedFluidType(key)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Droplet className={`w-4 h-4 ${config.iconColor}`} />
                    <h3 className="font-semibold text-slate-800 text-xs">{config.name}</h3>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <Button 
                onClick={() => setShowProjectModal(true)} 
                disabled={!selectedFluidType} 
                className="bg-[#115e59] hover:bg-[#0f766e] text-white h-8 text-xs px-3 py-1"
              >
                プロジェクト作成
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowProjectCreation(false)}
                className="h-8 text-xs px-3 py-1"
              >
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 期間選択 */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <span className="text-xs font-medium text-slate-700 whitespace-nowrap">表示期間:</span>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map(option => (
              <Button
                key={option.value}
                variant={period === option.value ? "default" : "outline"}
                onClick={() => setPeriod(option.value as PeriodType)}
                size="sm"
                className={period === option.value ? "bg-[#115e59] hover:bg-[#0f766e] text-white h-7 text-xs px-2 py-1" : "h-7 text-xs px-2 py-1"}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-2 sm:mt-0 sm:ml-3">
            現在の期間: {periodOptions.find(opt => opt.value === period)?.label} | プロジェクト数: {projects.length}
          </div>
        </div>
      </div>

      {/* プロジェクト一覧 */}
      <div className="space-y-6">
        {projects.map((project, projIndex) => {
          const projectDates = customDates[project.id] || generateDatesByPeriod(project.measurements, period);
          const projectItems = projectCustomItems[project.id] || [];
          // 🔧 安全なfluidConfig取得関数を使用
          const fluidConfig = getFluidConfig(project.fluidType);
          const isChartHidden = hiddenCharts[project.id] || false; // 🆕 グラフ表示状態
          
          const equipment = equipmentList.find(e => 
            e.id === project.config.equipmentId || 
            e.id.toString() === project.config.equipmentId ||
            e.id === parseInt(project.config.equipmentId)
          );
          
          // データ処理
          const mergedMap = new Map<string, FluidManagementData>();
          for (const m of project.measurements || []) {
            const dateKey = formatDate(m.date);
            mergedMap.set(dateKey, m);
          }

          // グラフ用データ準備
          const chartData = memoizedChartData[projIndex] || {
            labels: [],
            datasets: []
          };

          // 🆕 年度グループ化
          const yearGroups = projectDates.reduce((groups, date) => {
            const year = getYearFromDate(date);
            if (!groups[year]) groups[year] = [];
            groups[year].push(date);
            return groups;
          }, {} as Record<number, string[]>);

          return (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-50 p-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg text-slate-900 break-words">{project.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`${fluidConfig.color} text-white text-xs`}>
                        {fluidConfig.name}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {/* アイコンサイズ調整・ゴミ箱色変更 */}
                    <Button size="sm" onClick={() => downloadCSV(project)} title="CSV出力" className="h-7 w-7 p-0">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handlePrint(project.id, project.name)} title="印刷" className="h-7 w-7 p-0">
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => openProjectModal(project)} title="設定" className="h-7 w-7 p-0">
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => confirmDeleteProject(project)}
                      title="削除"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {/* 設備情報表示 */}
                <div className="mb-4 bg-slate-50 p-3 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700">設備:</span>
                      <p className="break-words">{equipment?.name || project.config.equipmentName || "未設定"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">使用資材:</span>
                      <p className="break-words">{project.config.selectedMaterialName || project.config.materialType || "未設定"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">表示範囲:</span>
                      <p>濃度: {project.config.displayRangeMin}% - {project.config.displayRangeMax}%</p>
                      <p>pH: {project.config.phDisplayRangeMin || 6} - {project.config.phDisplayRangeMax || 12}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">正常範囲:</span>
                      <p>濃度: {project.config.concentrationAlertMin}% - {project.config.concentrationAlertMax}%</p>
                      <p>pH: {project.config.phAlertMin} - {project.config.phAlertMax}</p>
                    </div>
                  </div>
                </div>

                {/* 🆕 グラフ（デフォルト表示・タイトル変更） */}
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      推移グラフ
                    </h3>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => toggleChartVisibility(project.id)}
                      className="h-7 text-xs px-2 py-1 w-full sm:w-auto"
                    >
                      {isChartHidden ? "グラフを表示" : "グラフを隠す"}
                    </Button>
                  </div>
                  
                  {!isChartHidden && (
                    <div>
                      {/* グラフ切り替えタブ */}
                      <div className="flex gap-1 mb-3 overflow-x-auto">
                        {chartViewOptions.map(option => (
                          <Button
                            key={option.value}
                            variant={getChartViewType(project.id) === option.value ? "default" : "outline"}
                            onClick={() => handleChartViewChange(project.id, option.value as ChartViewType)}
                            size="sm"
                            className={getChartViewType(project.id) === option.value ? "bg-[#115e59] hover:bg-[#0f766e] text-white h-7 text-xs px-2 py-1 flex-shrink-0" : "h-7 text-xs px-2 py-1 flex-shrink-0"}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      
                      <div id={`proj-${project.id}-chart`} className="h-64 bg-white p-3 border rounded-lg">
                        <Line
                          key={`chart-${project.id}-${period}-${getChartViewType(project.id)}`}
                          data={chartData}
                          options={getChartOptions(project)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* データ入力テーブル */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">測定データ</h3>
                    {/* 🆕 全期間の場合のみデータ追加ボタンを表示 */}
                    {period === 'all' && (
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={() => addNewDate(project.id)}
                        className="h-7 text-xs px-2 py-1 w-full sm:w-auto"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        データ追加
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div id={`proj-${project.id}-table`} className="min-w-max">
                      <table className="w-full text-xs border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-[#115e59] text-white">
                          <th className="border border-slate-300 p-2 text-left w-32 min-w-32 max-w-32">測定日</th>
                          {projectDates.map((date, i) => (
                          <th key={`${project.id}-header-${i}-${date}`} className="border border-slate-300 p-1 text-center min-w-16">
                            {/* 年度+日付を一行で表示 */}
                            {/* 🆕 全期間の場合のみ日付編集を有効化 */}
                            <div className={`p-1 rounded ${period === 'all' ? 'cursor-pointer hover:bg-slate-100 hover:text-slate-800' : ''}`}
                                onClick={period === 'all' ? () => handleDateEditStart(project.id, i, date) : undefined}
                                title={period === 'all' ? "クリックして日付を編集" : ""}>
                              <div className="text-xs opacity-75 mb-1 font-light">
                                {getShortYearFromDate(date)}
                              </div>
                              <div className="text-xs font-medium">
                                {formatDateForTable(date)}
                              </div>
                            </div>                          
                          </th>                         
                         ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* 固定項目（濃度・pH） */}
                        {fixedFields.map((field) => (
                          <tr key={field.key}>
                            <td className="border border-slate-300 p-2 font-medium bg-slate-50 w-32 min-w-32 max-w-32">
                              {field.label}
                            </td>
                            {projectDates.map((date, i) => {
                              const measurement = mergedMap.get(date);
                              const value = measurement?.values?.[field.key];
                              const cellKey = `${project.id}_${date}_${field.key}`;
                              const isEditing = editingCell === cellKey;
                              
                              // アラート値チェック
                              let cellClass = "border border-slate-300 p-1 text-center cursor-pointer hover:bg-slate-100";
                              if (field.key === 'concentration' && typeof value === 'number') {
                                if (value < project.config.concentrationAlertMin || value > project.config.concentrationAlertMax) {
                                  cellClass += " bg-red-100 border-red-500 text-red-700";
                                }
                              } else if (field.key === 'ph' && typeof value === 'number') {
                                if (value < project.config.phAlertMin || value > project.config.phAlertMax) {
                                  cellClass += " bg-red-100 border-red-500 text-red-700";
                                }
                              }

                              return (
                                <td key={`${project.id}-${field.key}-${i}-${date}`} className={cellClass}>
                                  {isEditing ? (
                                    <input
                                      type={field.type}
                                      value={tempValue}
                                      onChange={(e) => setTempValue(e.target.value)}
                                      onBlur={() => {
                                        if (tempValue && tempValue.trim() !== '') {
                                          handleCellSave(project.id, date, field.key);
                                        } else {
                                          setEditingCell(null);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          if (tempValue && tempValue.trim() !== '') {
                                            handleCellSave(project.id, date, field.key);
                                          } else {
                                            setEditingCell(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null);
                                        }
                                      }}
                                      className="w-full p-1 border-0 bg-transparent text-center"
                                      autoFocus
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleCellClick(project.id, date, field.key, value)}
                                      className="min-h-6 flex items-center justify-center"
                                    >
                                      {value?.toString() || '-'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* カスタム項目 */}
                        {projectItems.map((item) => (
                          <tr key={item}>
                            <td className="border border-slate-300 p-2 font-medium bg-slate-50 w-32 min-w-32 max-w-32">
                              <div className="flex items-center justify-between">
                                <span className="truncate">{item}</span>
                                <button
                                  onClick={() => handleRemoveCustomItem(project.id, item)}
                                  className="ml-2 text-red-500 hover:text-red-700 text-xs remove-item-btn flex-shrink-0"
                                  title="項目削除"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            {projectDates.map((date, i) => {
                              const measurement = mergedMap.get(date);
                              const value = measurement?.values?.[item] || '';
                              const cellKey = `${project.id}_${date}_${item}`;
                              const isEditing = editingCell === cellKey;

                              return (
                              <td key={`${project.id}-${item}-${i}-${date}`} className="border border-slate-300 p-1 text-center cursor-pointer hover:bg-slate-100 w-24 max-w-24">
                                {isEditing ? (
                                  <textarea
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => {
                                      if (tempValue && tempValue.trim() !== '') {
                                        handleCellSave(project.id, date, item);
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (tempValue && tempValue.trim() !== '') {
                                          handleCellSave(project.id, date, item);
                                        } else {
                                          setEditingCell(null);
                                        }
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                    className="w-full p-1 border-0 bg-transparent text-center resize-none min-h-8 text-xs"
                                    placeholder="記述入力"
                                    autoFocus
                                    rows={3}
                                  />
                                ) : (
                                <div
                                  onClick={() => handleCellClick(project.id, date, item, value)}
                                  className="w-full text-center text-xs leading-tight"
                                  style={{ wordWrap: 'break-word', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {value || '-'}
                              </div>                             
                             )}
                              </td>

                              );
                            })}
                          </tr>
                        ))}

                        {/* 項目追加行 */}
                        <tr className="no-print">
                          <td className="border border-slate-300 p-2 text-center no-print w-32 min-w-32 max-w-32">
                            <Button
                              onClick={() => handleAddCustomItem(project.id)}
                              variant="outline"
                              size="sm"
                              className="text-[#115e59] hover:text-[#0f766e] border-[#115e59] no-print whitespace-nowrap min-w-fit h-7 text-xs px-2 py-1"
                            >
                              <Plus className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="hidden sm:inline">項目追加</span>
                              <span className="sm:hidden">追加</span>
                            </Button>
                          </td>
                          {projectDates.map((_, i) => (
                            <td key={`add-${project.id}-${i}`} className="border border-slate-300 p-2 no-print"></td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && !loading && (
        <Card className="text-center py-8">
          <CardContent>
            <div className="text-slate-500">
              <Calendar className="w-8 sm:w-12 h-8 sm:h-12 mx-auto mb-3 opacity-50" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">プロジェクトがありません</h3>
              <p className="mb-3 text-xs sm:text-sm">新しいプロジェクトを作成して、データモニタリングを開始しましょう。</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* プロジェクト作成/編集モーダル */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'プロジェクト設定変更' : 'プロジェクト作成'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">プロジェクト名*</label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({...projectForm, name: e.target.value})}
                placeholder="プロジェクト名を入力"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">設備</label>
              <Select
                value={projectForm.equipmentId}
                onValueChange={(value) => {
                  const selectedEquipment = equipmentList.find(eq => eq.id === value || eq.id.toString() === value);
                  setProjectForm({
                    ...projectForm, 
                    equipmentId: value,
                    equipmentName: selectedEquipment?.name || "",
                    // 🆕 設備変更時は使用資材選択をリセット
                    selectedMaterialId: '',
                    selectedMaterialName: '',
                    materialType: ''
                  });
                  // 🆕 設備選択時に使用資材を取得
                  fetchEquipmentMaterials(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="設備を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.length > 0 ? (
                    equipmentList.map(equipment => (
                      <SelectItem key={equipment.id} value={equipment.id.toString()}>
                        {equipment.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-equipment" disabled>
                      設備が登録されていません
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {equipmentList.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  ※ 設備管理ページで設備を登録してから選択してください
                </p>
              )}
            </div>

            {/* 🆕 使用資材選択フィールド */}
            {projectForm.equipmentId && (
              <div>
                <label className="block text-sm font-medium mb-1">使用資材</label>
                {loadingMaterials ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#115e59]"></div>
                    <span className="text-sm text-slate-600">使用資材を読み込み中...</span>
                  </div>
                ) : selectedEquipmentMaterials.length > 0 ? (
                  <Select
                    value={projectForm.selectedMaterialId}
                    onValueChange={(value) => {
                      const selectedMaterial = selectedEquipmentMaterials.find(m => m.id.toString() === value);
                      setProjectForm({
                        ...projectForm,
                        selectedMaterialId: value,
                        selectedMaterialName: selectedMaterial?.product?.name || '',
                        materialType: selectedMaterial?.product?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="使用資材を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedEquipmentMaterials.map(material => (
                        <SelectItem key={material.id} value={material.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{material.product.name}</span>
                            <span className="text-xs text-slate-500">
                              {material.product.manufacturer} | {material.product.capacity} | {material.product.oilType}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 border rounded-md bg-slate-50">
                    <p className="text-sm text-slate-600">
                      この設備に使用資材が登録されていません
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      設備情報ページで使用資材を追加してください
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 🆕 手動入力の使用資材（使用資材が選択されていない場合のみ表示） */}
            {!projectForm.selectedMaterialId && (
              <div>
                <label className="block text-sm font-medium mb-1">使用資材（手動入力）</label>
                <Input
                  value={projectForm.materialType}
                  onChange={(e) => setProjectForm({...projectForm, materialType: e.target.value})}
                  placeholder="使用資材名を入力"
                  maxLength={100}
                />
                <p className="text-xs text-slate-500 mt-1">
                  ※ 設備に使用資材が登録されていない場合に手動入力してください
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">表示範囲 - 濃度</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={projectForm.displayRangeMin}
                  onChange={(e) => setProjectForm({...projectForm, displayRangeMin: parseFloat(e.target.value) || 0})}
                  placeholder="最小値(%)"
                  step="0.1"
                />
                <Input
                  type="number"
                  value={projectForm.displayRangeMax}
                  onChange={(e) => setProjectForm({...projectForm, displayRangeMax: parseFloat(e.target.value) || 20})}
                  placeholder="最大値(%)"
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">表示範囲 - pH</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={projectForm.phDisplayRangeMin}
                  onChange={(e) => setProjectForm({...projectForm, phDisplayRangeMin: parseFloat(e.target.value) || 6})}
                  placeholder="最小値"
                  step="0.1"
                />
                <Input
                  type="number"
                  value={projectForm.phDisplayRangeMax}
                  onChange={(e) => setProjectForm({...projectForm, phDisplayRangeMax: parseFloat(e.target.value) || 12})}
                  placeholder="最大値"
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">正常範囲 - 濃度</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={projectForm.concentrationAlertMin}
                  onChange={(e) => setProjectForm({...projectForm, concentrationAlertMin: parseFloat(e.target.value) || 0})}
                  placeholder="下限値(%)"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={projectForm.concentrationAlertMax}
                  onChange={(e) => setProjectForm({...projectForm, concentrationAlertMax: parseFloat(e.target.value) || 20})}
                  placeholder="上限値(%)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">正常範囲 - pH</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={projectForm.phAlertMin}
                  onChange={(e) => setProjectForm({...projectForm, phAlertMin: parseFloat(e.target.value) || 0})}
                  placeholder="下限値"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={projectForm.phAlertMax}
                  onChange={(e) => setProjectForm({...projectForm, phAlertMax: parseFloat(e.target.value) || 14})}
                  placeholder="上限値"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectModal(false)}>
              キャンセル
            </Button>
            <Button onClick={saveProject} disabled={loading} className="bg-[#115e59] hover:bg-[#0f766e] text-white">
              {editingProject ? '更新' : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🆕 日付編集モーダル（共通コンポーネント使用） */}
      <Dialog open={showDateEditModal} onOpenChange={(open) => {
        setShowDateEditModal(open);
        if (!open) {
          setEditingDateInfo(null);
          setNewEditDate('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              測定日を追加
              {editingDateInfo && (
                <span className="block text-sm font-normal text-slate-600 mt-1">
                  プロジェクト: {projects.find(p => p.id === editingDateInfo.projectId)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">新しい測定日*</label>
              <Input
                type="date"
                value={newEditDate}
                onChange={(e) => setNewEditDate(e.target.value)}
                autoFocus
                max={new Date().toISOString().split('T')[0]} // 今日まで
              />
              <p className="text-xs text-slate-500 mt-1">
                {period === 'all' ? (
                  '任意の過去の日付を入力してください'
                ) : (
                  `表示期間（${periodOptions.find(opt => opt.value === period)?.label}）内の日付を入力してください`
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowDateEditModal(false);
                setEditingDateInfo(null);
                setNewEditDate('');
              }}
            >
              キャンセル
            </Button>
            <Button 
              onClick={handleDateEditSave}
              className="bg-[#115e59] hover:bg-[#0f766e] text-white"
            >
              更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 日付入力モーダル */}
      <Dialog open={showDateInputModal} onOpenChange={(open) => {
        setShowDateInputModal(open);
        if (!open) {
          setSelectedProjectForDate(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              測定日を追加
              {selectedProjectForDate && (
                <span className="block text-sm font-normal text-slate-600 mt-1">
                  プロジェクト: {projects.find(p => p.id === selectedProjectForDate)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">測定日*</label>
              <Input
                type="date"
                value={newDateInput}
                onChange={(e) => setNewDateInput(e.target.value)}
                disabled={isAddingDate}
                autoFocus
                max={new Date().toISOString().split('T')[0]} // 今日まで
              />
              <p className="text-xs text-slate-500 mt-1">
                {period === 'all' ? (
                  '任意の過去の日付を入力してください'
                ) : (
                  `表示期間（${periodOptions.find(opt => opt.value === period)?.label}）内の日付を入力してください`
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowDateInputModal(false);
                setSelectedProjectForDate(null);
              }}
              disabled={isAddingDate}
            >
              キャンセル
            </Button>
            <Button 
              onClick={handleSaveDateInput}
              disabled={isAddingDate}
              className="bg-[#115e59] hover:bg-[#0f766e] text-white"
            >
              {isAddingDate ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>追加中...</span>
                </div>
              ) : (
                '追加'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 項目追加モーダル */}
      <Dialog open={showAddItemModal} onOpenChange={(open) => {
        setShowAddItemModal(open);
        if (!open) {
          setSelectedProjectForItem(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              測定項目を追加
              {selectedProjectForItem && (
                <span className="block text-sm font-normal text-slate-600 mt-1">
                  プロジェクト: {projects.find(p => p.id === selectedProjectForItem)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">項目名*</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="項目名を入力（例：外観、加工性など）"
                maxLength={50}
                disabled={isAddingItem}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingItem) {
                    handleSaveNewItem();
                  }
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                {newItemName.length}/50文字
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowAddItemModal(false);
                setSelectedProjectForItem(null);
              }}
              disabled={isAddingItem}
            >
              キャンセル
            </Button>
            <Button 
              onClick={handleSaveNewItem}
              disabled={isAddingItem}
              className="bg-[#115e59] hover:bg-[#0f766e] text-white"
            >
              {isAddingItem ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>追加中...</span>
                </div>
              ) : (
                '追加'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast通知 */}
      <ToastContainer 
        toasts={toasts}
        onClose={removeToast}
        position="top-right"
      />
    </div>
  );
}
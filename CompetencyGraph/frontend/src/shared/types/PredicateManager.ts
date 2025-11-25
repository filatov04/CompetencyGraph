class PredicateManager {
    private static instance: PredicateManager;
    private predicates: Set<string>;
    

    private constructor() {  
        this.predicates = new Set();

    }

    public static getInstance(): PredicateManager {
        if (!PredicateManager.instance) {
            PredicateManager.instance = new PredicateManager();
        }
        return PredicateManager.instance;
    }

    public clear(): void {
    this.predicates.clear();
    
  }
  
    public generatePredicateUri(label: string): string {
        // Если уже полный URI - возвращаем как есть
        if (label.startsWith('http://') || label.startsWith('https://')) {
            return label;
        }
        // Генерируем валидный URI для предиката
        const namespace = 'http://example.org/competencies#';
        const cleanLabel = label.replace(/\s+/g, '_');
        return namespace + cleanLabel;
    }
    
    public registerPredicate(predicate: string): void {
        // Преобразуем в URI если это не URI
        const predicateUri = this.generatePredicateUri(predicate);
        if (!this.predicates.has(predicateUri)) {
            this.predicates.add(predicateUri);
        }
    }

    public getAllPredicates(): string[] {
        return Array.from(this.predicates).sort();
    }

}

export default PredicateManager.getInstance();
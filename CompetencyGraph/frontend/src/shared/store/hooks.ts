import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

// Типизированные хуки для использования в компонентах
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();


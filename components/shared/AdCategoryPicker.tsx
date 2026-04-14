import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type TextStyle,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  AD_CATEGORIES,
  MIN_AD_CATEGORIES,
  type AdCategory,
} from '../../constants/adCategories';

interface AdCategoryPickerProps {
  selectedCategories: Set<string>;
  selectedSubcategories: Set<string>;
  onToggleCategory: (categoryId: string) => void;
  onToggleSubcategory: (categoryId: string, subcategoryId: string) => void;
}

export function AdCategoryPicker({
  selectedCategories,
  selectedSubcategories,
  onToggleCategory,
  onToggleSubcategory,
}: AdCategoryPickerProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {selectedCategories.size} of {MIN_AD_CATEGORIES}+ selected
      </Text>

      {AD_CATEGORIES.map((cat) => {
        const isSelected = selectedCategories.has(cat.id);
        const isExpanded = expandedCategory === cat.id;
        const hasSubcategories = cat.subcategories && cat.subcategories.length > 0;

        return (
          <View key={cat.id}>
            <TouchableOpacity
              style={[styles.categoryRow, isSelected && styles.categoryRowSelected]}
              onPress={() => {
                onToggleCategory(cat.id);
                if (hasSubcategories && !isExpanded) {
                  setExpandedCategory(cat.id);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon as any} size={20} color={isSelected ? Colors.primary : Colors.textSecondary} style={styles.categoryIcon as TextStyle} />
              <Text
                style={[
                  styles.categoryLabel,
                  isSelected && styles.categoryLabelSelected,
                ]}
              >
                {cat.label}
              </Text>
              {hasSubcategories && isSelected && (
                <TouchableOpacity
                  onPress={() =>
                    setExpandedCategory(isExpanded ? null : cat.id)
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.expandArrow}>
                    {isExpanded ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Subcategories */}
            {isExpanded && isSelected && hasSubcategories && (
              <View style={styles.subcategories}>
                {cat.subcategories!.map((sub) => {
                  const subSelected = selectedSubcategories.has(sub.id);
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subChip,
                        subSelected && styles.subChipSelected,
                      ]}
                      onPress={() => onToggleSubcategory(cat.id, sub.id)}
                    >
                      <Text
                        style={[
                          styles.subChipText,
                          subSelected && styles.subChipTextSelected,
                        ]}
                      >
                        {sub.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  counter: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  categoryIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
  },
  categoryLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  expandArrow: {
    fontSize: 16,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  subcategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 56,
    paddingVertical: 10,
  },
  subChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subChipText: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  subChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

import Settings from '../settings';
import { Pattern, PatternsGroup } from '../types/index';
import * as utils from '../utils/index';

export interface Task {
	base: string;
	dynamic: boolean;
	patterns: Pattern[];
	positive: Pattern[];
	negative: Pattern[];
}

export function generate(patterns: Pattern[], settings: Settings): Task[] {
	const positivePatterns = getPositivePatterns(patterns);
	const negativePatterns = getNegativePatternsAsPositive(patterns, settings.ignore);

	/**
	 * When the `caseSensitiveMatch` option is disabled, all patterns must be marked as dynamic, because we cannot check
	 * filepath directly (without read directory).
	 */
	const staticPatterns = !settings.caseSensitiveMatch ? [] : positivePatterns.filter(utils.pattern.isStaticPattern);
	const dynamicPatterns = !settings.caseSensitiveMatch ? positivePatterns : positivePatterns.filter(utils.pattern.isDynamicPattern);

	const staticTasks = convertPatternsToTasks(staticPatterns, negativePatterns, /* dynamic */ false);
	const dynamicTasks = convertPatternsToTasks(dynamicPatterns, negativePatterns, /* dynamic */ true);

	return staticTasks.concat(dynamicTasks);
}

export function convertPatternsToTasks(positive: Pattern[], negative: Pattern[], dynamic: boolean): Task[] {
	const positivePatternsGroup = groupPatternsByBaseDirectory(positive);

	// When we have a global group – there is no reason to divide the patterns into independent tasks.
	// In this case, the global task covers the rest.
	if ('.' in positivePatternsGroup) {
		const task = convertPatternGroupToTask('.', positive, negative, dynamic);

		return [task];
	}

	return convertPatternGroupsToTasks(positivePatternsGroup, negative, dynamic);
}

export function getPositivePatterns(patterns: Pattern[]): Pattern[] {
	return utils.pattern.getPositivePatterns(patterns);
}

export function getNegativePatternsAsPositive(patterns: Pattern[], ignore: Pattern[]): Pattern[] {
	const negative = utils.pattern.getNegativePatterns(patterns).concat(ignore);
	const positive = negative.map(utils.pattern.convertToPositivePattern);

	return positive;
}

export function groupPatternsByBaseDirectory(patterns: Pattern[]): PatternsGroup {
	return patterns.reduce((collection, pattern) => {
		const base = utils.pattern.getBaseDirectory(pattern);

		if (base in collection) {
			collection[base].push(pattern);
		} else {
			collection[base] = [pattern];
		}

		return collection;
	}, {} as PatternsGroup);
}

export function convertPatternGroupsToTasks(positive: PatternsGroup, negative: Pattern[], dynamic: boolean): Task[] {
	return Object.keys(positive).map((base) => {
		return convertPatternGroupToTask(base, positive[base], negative, dynamic);
	});
}

export function convertPatternGroupToTask(base: string, positive: Pattern[], negative: Pattern[], dynamic: boolean): Task {
	return {
		dynamic,
		positive,
		negative,
		base,
		patterns: ([] as Pattern[]).concat(positive, negative.map(utils.pattern.convertToNegativePattern))
	};
}

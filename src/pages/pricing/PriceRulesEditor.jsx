import RuleEditorPage from './_RuleEditorPage'

export default function PriceRulesEditor() {
  return (
    <RuleEditorPage
      ruleFamily="price"
      title="Price Rules"
      description="Define item-level and quote-level pricing formulas."
    />
  )
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  center?: boolean;
};

export default function SectionHeader({ title, subtitle, center = false }: SectionHeaderProps) {
  return (
    <div className={`home-section-header ${center ? "home-section-header--center" : ""}`}>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

import React from 'react';
import './AboutPage.css';

export const AboutPage: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="about-page">
      <div className="about-header">
        <h1 className="about-title">Об этом приложении</h1>
        <p className="about-subtitle">Система контроля въезда и выезда транспортных средств</p>
      </div>

      <div className="about-sections">

        <section className="about-section">
          <h2>О системе</h2>
          <p>
            Система контроля въезда и выезда транспортных средств предназначена для автоматического
            распознавания номерных знаков и ведения учёта проездов на охраняемой территории.
          </p>
        </section>

        <section className="about-section">
          <h2>Версия</h2>
          <table className="about-table">
            <tbody>
              <tr>
                <td className="about-table-label">Версия приложения</td>
                <td>1.0.0</td>
              </tr>
              <tr>
                <td className="about-table-label">Дата выпуска</td>
                <td>15.05.2026</td>
              </tr>
              <tr>
                <td className="about-table-label">Последнее обновление</td>
                <td>08.06.2026</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="about-section">
          <h2>Разработчик</h2>
          <table className="about-table">
            <tbody>
              <tr>
                <td className="about-table-label">Разработчик</td>
                <td>Василевский Иван Васильевич</td>
              </tr>
              <tr>
                <td className="about-table-label">Контакт</td>
                <td>xl.xd@ya.ru</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="about-section">
          <h2>Лицензия и авторские права</h2>
          <div className="about-license">
            <p className="about-copyright">
              &copy; {currentYear} Василевский Иван Васильевич. Все права защищены.
            </p>
            <p>
              Данное программное обеспечение является собственностью правообладателя.
              Несанкционированное копирование, распространение или модификация запрещены.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

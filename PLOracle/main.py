# Updated main.py with visualization integration

import os
import sys
from pathlib import Path
import yaml
from colorama import init, Fore, Style
from src.prediction.predictor import EPLPredictor
import threading
import time
import logging
from typing import Dict, Optional

# Initialize colorama
init()

class EPLPredictor:
    def __init__(self):
        self.config = self.load_config()
        self.data_handler = None
        self.visualizer = None
        self.current_charts = {}
        self.logger = self._setup_logging()
        self.initialize_system()

    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('EPL_Predictor')
        logger.setLevel(logging.INFO)
        return logger

    def load_config(self) -> Dict:
        """Load configuration from YAML file"""
        try:
            config_path = Path("config/config.yaml")
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"{Fore.RED}Error loading configuration: {str(e)}{Style.RESET_ALL}")
            sys.exit(1)

    def show_match_analysis(self):
        """Display match analysis and prediction"""
        try:
            teams = self.data_handler.get_available_teams()
            print("\nSelect Home Team:")
            for team in sorted(teams):
                print(f"  • {team}")
            
            home_team = input(f"\n{Fore.YELLOW}Home team: {Style.RESET_ALL}")
            if home_team not in teams:
                print(f"{Fore.RED}Invalid team name: {home_team}{Style.RESET_ALL}")
                return
                
            print("\nSelect Away Team:")
            away_team = input(f"{Fore.YELLOW}Away team: {Style.RESET_ALL}")
            if away_team not in teams:
                print(f"{Fore.RED}Invalid team name: {away_team}{Style.RESET_ALL}")
                return

            # Get match analysis data
            analysis_data = self.data_handler.get_head_to_head(home_team, away_team)
            
            # Create visualizations
            charts = {
                'h2h': self.visualizer.create_head_to_head_chart(analysis_data),
                'form': self.visualizer.create_form_comparison(
                    self.data_handler.get_team_form(home_team),
                    self.data_handler.get_team_form(away_team)
                ),
                'stats': self.visualizer.create_stats_comparison(home_team, away_team),
                'prediction': self.visualizer.create_win_probability_chart(
                    self.get_match_prediction(home_team, away_team)
                )
            }

            self._show_interactive_analysis(charts, home_team, away_team)

        except Exception as e:
            print(f"{Fore.RED}Error in match analysis: {str(e)}{Style.RESET_ALL}")

    def show_season_comparison(self):
        """Display season comparison analysis"""
        try:
            # Get seasons
            seasons = self.data_handler.get_available_seasons()
            print("\nAvailable Seasons:")
            for season in seasons:
                print(f"  • {season}")

            # Get team
            teams = self.data_handler.get_available_teams()
            print("\nSelect Team:")
            for team in sorted(teams):
                print(f"  • {team}")

            team = input(f"\n{Fore.YELLOW}Team: {Style.RESET_ALL}")
            if team not in teams:
                print(f"{Fore.RED}Invalid team name{Style.RESET_ALL}")
                return

            # Create season comparison charts
            charts = {
                'points': self.visualizer.create_season_progress_chart(
                    self.data_handler.get_season_progress(team)
                ),
                'performance': self.visualizer.create_performance_comparison(
                    self.data_handler.get_seasonal_performance(team)
                ),
                'trends': self.visualizer.create_trend_analysis(
                    self.data_handler.get_trend_data(team)
                )
            }

            self._show_interactive_comparison(charts, team)

        except Exception as e:
            print(f"{Fore.RED}Error in season comparison: {str(e)}{Style.RESET_ALL}")

    def show_league_table(self):
        """Display interactive league table"""
        try:
            table_data = self.data_handler.get_league_table()
            
            print("\nVisualization Options:")
            print("1. Standard Table")
            print("2. Points Timeline")
            print("3. Form Guide")
            print("4. Performance Matrix")
            
            choice = input(f"\n{Fore.YELLOW}Select visualization: {Style.RESET_ALL}")
            
            if choice == '1':
                self._display_standard_table(table_data)
            elif choice == '2':
                chart = self.visualizer.create_points_timeline(table_data)
                self._show_interactive_chart(chart, "Points Timeline")
            elif choice == '3':
                chart = self.visualizer.create_form_guide(table_data)
                self._show_interactive_chart(chart, "Form Guide")
            elif choice == '4':
                chart = self.visualizer.create_performance_matrix(table_data)
                self._show_interactive_chart(chart, "Performance Matrix")

        except Exception as e:
            print(f"{Fore.RED}Error displaying league table: {str(e)}{Style.RESET_ALL}")

    def _show_interactive_analysis(self, charts: Dict, home_team: str, away_team: str):
        """Display interactive match analysis"""
        while True:
            print(f"\n{Fore.CYAN}Match Analysis Controls{Style.RESET_ALL}")
            print("1. 📊 Switch Chart View")
            print("2. 🔄 Update Data")
            print("3. 📈 Change Metrics")
            print("4. 💾 Export Analysis")
            print("5. 📊 Show Detailed Stats")
            print("6. ⬅️ Back to Main Menu")

            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

            if choice == '1':
                self._switch_analysis_view(charts)
            elif choice == '2':
                self._update_analysis_data(charts, home_team, away_team)
            elif choice == '3':
                self._change_analysis_metrics(charts)
            elif choice == '4':
                self._export_analysis(charts, home_team, away_team)
            elif choice == '5':
                self._show_detailed_stats(home_team, away_team)
            elif choice == '6':
                break

    def _export_analysis(self, charts: Dict, home_team: str, away_team: str):
        """Export analysis to various formats"""
        print("\nExport Options:")
        print("1. 📊 Export Charts (PNG)")
        print("2. 📑 Export Report (PDF)")
        print("3. 📈 Export Data (CSV)")
        print("4. 📧 Share Analysis")

        choice = input(f"\n{Fore.YELLOW}Select export option: {Style.RESET_ALL}")

        try:
            if choice == '1':
                export_path = f"exports/{home_team}_vs_{away_team}_charts.png"
                self.visualizer.export_charts(charts, export_path)
                print(f"{Fore.GREEN}Charts exported to {export_path}{Style.RESET_ALL}")
            
            elif choice == '2':
                export_path = f"exports/{home_team}_vs_{away_team}_report.pdf"
                self.visualizer.export_report(charts, home_team, away_team, export_path)
                print(f"{Fore.GREEN}Report exported to {export_path}{Style.RESET_ALL}")
            
            elif choice == '3':
                export_path = f"exports/{home_team}_vs_{away_team}_data.csv"
                self.data_handler.export_analysis_data(home_team, away_team, export_path)
                print(f"{Fore.GREEN}Data exported to {export_path}{Style.RESET_ALL}")
            
            elif choice == '4':
                self._share_analysis(charts, home_team, away_team)
            
        except Exception as e:
            print(f"{Fore.RED}Error exporting analysis: {str(e)}{Style.RESET_ALL}")

    def _show_interactive_chart(self, chart, title: str):
        """Display interactive chart with controls"""
        while True:
            print(f"\n{Fore.CYAN}{title} Controls{Style.RESET_ALL}")
            print("1. 🔍 Zoom In/Out")
            print("2. 🔄 Rotate View")
            print("3. 📊 Change Style")
            print("4. 💾 Export Chart")
            print("5. ⬅️ Back")

            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

            if choice == '1':
                self._handle_zoom(chart)
            elif choice == '2':
                self._rotate_chart(chart)
            elif choice == '3':
                self._change_chart_style(chart)
            elif choice == '4':
                self._export_chart(chart, title)
            elif choice == '5':
                break

    def _handle_zoom(self, chart):
        """Handle chart zoom controls"""
        print("\nZoom Controls:")
        print("1. 🔍 Zoom In")
        print("2. 🔎 Zoom Out")
        print("3. ↔️ Custom Range")

        choice = input(f"\n{Fore.YELLOW}Select zoom option: {Style.RESET_ALL}")
        
        try:
            if choice == '1':
                chart.zoom_in()
            elif choice == '2':
                chart.zoom_out()
            elif choice == '3':
                self._set_custom_range(chart)
        except Exception as e:
            print(f"{Fore.RED}Error adjusting zoom: {str(e)}{Style.RESET_ALL}")

    def initialize_system(self):
        """Initialize system components"""
        try:
            # Initialize data handler
            self.data_handler = EPLDataHandler(config_path="config/config.yaml")
            
            # Initialize visualizer
            self.visualizer = EPLVizualizer()
            
            print(f"{Fore.GREEN}System initialized successfully!{Style.RESET_ALL}")
            
        except Exception as e:
            print(f"{Fore.RED}Error initializing system: {str(e)}{Style.RESET_ALL}")
            sys.exit(1)

    def display_menu(self) -> str:
        """Display interactive menu"""
        print(f"\n{Fore.CYAN}═══ EPL Predictor & Analyzer ═══{Style.RESET_ALL}")
        print("1. 🎯 Match Analysis & Prediction")
        print("2. 📊 Team Performance Dashboard")
        print("3. 📈 Season Comparison")
        print("4. 🤼 Head-to-Head Analysis")
        print("5. 📋 League Table")
        print("6. 📉 Form Analysis")
        print("7. 🔄 Update Data")
        print("8. ❌ Exit")
        return input(f"\n{Fore.YELLOW}Select an option (1-8): {Style.RESET_ALL}")

    def show_team_dashboard(self):
        """Display comprehensive team dashboard"""
        try:
            # Get available teams
            teams = self.data_handler.get_available_teams()
            print("\nAvailable teams:")
            for team in sorted(teams):
                print(f"  • {team}")
            
            team = input(f"\n{Fore.YELLOW}Enter team name: {Style.RESET_ALL}")
            if team not in teams:
                print(f"{Fore.RED}Invalid team name: {team}{Style.RESET_ALL}")
                return

            print(f"\n{Fore.CYAN}Generating dashboard for {team}...{Style.RESET_ALL}")

            # Get team data
            team_data = self.data_handler.get_team_performance_metrics(team)
            historical_data = self.data_handler.get_historical_performance(team)

            # Create visualizations
            self.current_charts = {}  # Clear previous charts

            # Season Comparison Chart
            print("Creating season comparison chart...")
            self.current_charts['season'] = self.visualizer.create_season_comparison_chart(
                self.data_handler.get_visualization_data('season_comparison', team)
            )

            # Form Chart
            print("Creating form chart...")
            self.current_charts['form'] = self.visualizer.create_form_chart(
                self.data_handler.get_visualization_data('form_trends', team)
            )

            # Goal Flow Chart
            print("Creating goal flow chart...")
            self.current_charts['goals'] = self.visualizer.create_goal_flow_chart(
                self.data_handler.get_visualization_data('scoring_patterns', team)
            )

            # Performance Radar
            print("Creating performance radar...")
            self.current_charts['radar'] = self.visualizer.create_team_performance_radar(
                team_data, historical_data
            )

            self._display_dashboard_controls()

        except Exception as e:
            print(f"{Fore.RED}Error displaying team dashboard: {str(e)}{Style.RESET_ALL}")

    def _display_dashboard_controls(self):
        """Display interactive dashboard controls"""
        while True:
            print(f"\n{Fore.CYAN}Dashboard Controls{Style.RESET_ALL}")
            print("1. 🔄 Switch Chart")
            print("2. 📊 Change Metric")
            print("3. 📅 Change Time Period")
            print("4. 💾 Export Chart")
            print("5. ⬅️ Back to Main Menu")
            
            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")
            
            if choice == '1':
                self._switch_chart_view()
            elif choice == '2':
                self._change_metric()
            elif choice == '3':
                self._change_time_period()
            elif choice == '4':
                self._export_chart()
            elif choice == '5':
                break

    def _switch_chart_view(self):
        """Switch between different chart views"""
        print("\nAvailable Charts:")
        for idx, chart_name in enumerate(self.current_charts.keys(), 1):
            print(f"{idx}. {chart_name.title()}")
        
        choice = input(f"\n{Fore.YELLOW}Select chart number: {Style.RESET_ALL}")
        try:
            chart_name = list(self.current_charts.keys())[int(choice)-1]
            self.current_charts[chart_name].show()
        except (IndexError, ValueError):
            print(f"{Fore.RED}Invalid selection{Style.RESET_ALL}")

    def _change_metric(self):
        """Change displayed metrics"""
        print("\nAvailable Metrics:")
        metrics = [
            "Points", "Goals", "Form", "Expected Goals",
            "Shot Accuracy", "Clean Sheets", "Win Rate"
        ]
        for idx, metric in enumerate(metrics, 1):
            print(f"{idx}. {metric}")
        
        choice = input(f"\n{Fore.YELLOW}Select metric number: {Style.RESET_ALL}")
        # Implementation of metric change would go here

    def run(self):
        """Main application loop"""
        print(f"\n{Fore.GREEN}EPL Predictor is running. Use the menu below to interact.{Style.RESET_ALL}")
        
        while True:
            try:
                choice = self.display_menu()
                
                if choice == '1':
                    self.show_match_analysis()
                elif choice == '2':
                    self.show_team_dashboard()
                elif choice == '3':
                    self.show_season_comparison()
                elif choice == '4':
                    self.show_head_to_head()
                elif choice == '5':
                    self.show_league_table()
                elif choice == '6':
                    self.show_form_analysis()
                elif choice == '7':
                    self.update_data()
                elif choice == '8':
                    print(f"\n{Fore.YELLOW}Stopping EPL Predictor...{Style.RESET_ALL}")
                    break
                else:
                    print(f"\n{Fore.RED}Invalid option. Please try again.{Style.RESET_ALL}")
                    
                time.sleep(0.5)
                
            except KeyboardInterrupt:
                print(f"\n{Fore.YELLOW}Stopping EPL Predictor...{Style.RESET_ALL}")
                break
            except Exception as e:
                print(f"\n{Fore.RED}An error occurred: {str(e)}{Style.RESET_ALL}")
                continue

    def show_form_analysis(self):
        """Display detailed form analysis"""
        try:
            team = self._get_team_selection()
            if not team:
                return

            print(f"\n{Fore.CYAN}Form Analysis for {team}{Style.RESET_ALL}")
            
            # Create specialized form charts
            charts = {
                'streak': self.visualizer.create_streak_analysis(
                    self.data_handler.get_team_streaks(team)
                ),
                'performance': self.visualizer.create_performance_heatmap(
                    self.data_handler.get_performance_data(team)
                ),
                'scoring': self.visualizer.create_scoring_patterns(
                    self.data_handler.get_scoring_patterns(team)
                ),
                'opposition': self.visualizer.create_opposition_analysis(
                    self.data_handler.get_opposition_performance(team)
                )
            }

            while True:
                print("\nForm Analysis Options:")
                print("1. 📈 Streak Analysis")
                print("2. 🌡️ Performance Heatmap")
                print("3. ⚽ Scoring Patterns")
                print("4. 🤼 Opposition Analysis")
                print("5. 🔄 Update Analysis")
                print("6. 💾 Export Analysis")
                print("7. ⬅️ Back to Main Menu")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

                if choice == '1':
                    self._show_streak_analysis(charts['streak'], team)
                elif choice == '2':
                    self._show_performance_heatmap(charts['performance'], team)
                elif choice == '3':
                    self._show_scoring_patterns(charts['scoring'], team)
                elif choice == '4':
                    self._show_opposition_analysis(charts['opposition'], team)
                elif choice == '5':
                    self._update_form_analysis(charts, team)
                elif choice == '6':
                    self._export_form_analysis(charts, team)
                elif choice == '7':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error in form analysis: {str(e)}{Style.RESET_ALL}")

    def _show_streak_analysis(self, chart, team: str):
        """Display interactive streak analysis"""
        try:
            print(f"\n{Fore.CYAN}Streak Analysis Controls{Style.RESET_ALL}")
            
            while True:
                print("\n1. 📊 View Winning Streaks")
                print("2. 🛡️ View Clean Sheet Streaks")
                print("3. ⚽ View Scoring Streaks")
                print("4. 📈 View Trend Analysis")
                print("5. ⬅️ Back")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

                if choice == '1':
                    chart.animate_streak_type('winning')
                elif choice == '2':
                    chart.animate_streak_type('clean_sheet')
                elif choice == '3':
                    chart.animate_streak_type('scoring')
                elif choice == '4':
                    self._show_trend_analysis(chart)
                elif choice == '5':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error showing streak analysis: {str(e)}{Style.RESET_ALL}")

    def _show_performance_heatmap(self, chart, team: str):
        """Display interactive performance heatmap"""
        try:
            print(f"\n{Fore.CYAN}Performance Heatmap Controls{Style.RESET_ALL}")
            
            while True:
                print("\n1. 📅 Change Time Period")
                print("2. 🔄 Change Metrics")
                print("3. 🎨 Change Color Scheme")
                print("4. 🔍 Zoom Controls")
                print("5. 💾 Export Heatmap")
                print("6. ⬅️ Back")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

                if choice == '1':
                    self._change_time_period(chart)
                elif choice == '2':
                    self._change_heatmap_metrics(chart)
                elif choice == '3':
                    self._change_color_scheme(chart)
                elif choice == '4':
                    self._handle_zoom(chart)
                elif choice == '5':
                    self._export_chart(chart, f"{team}_heatmap")
                elif choice == '6':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error showing performance heatmap: {str(e)}{Style.RESET_ALL}")

    def _export_chart(self, chart, name: str):
        """Export chart with various options"""
        try:
            print("\nExport Options:")
            print("1. 📸 PNG Image")
            print("2. 📊 SVG Vector")
            print("3. 📑 PDF Document")
            print("4. 💻 Interactive HTML")

            choice = input(f"\n{Fore.YELLOW}Select export format: {Style.RESET_ALL}")
            
            # Create exports directory if it doesn't exist
            Path("exports").mkdir(exist_ok=True)

            timestamp = time.strftime("%Y%m%d_%H%M%S")
            
            if choice == '1':
                filepath = f"exports/{name}_{timestamp}.png"
                chart.export_png(filepath)
            elif choice == '2':
                filepath = f"exports/{name}_{timestamp}.svg"
                chart.export_svg(filepath)
            elif choice == '3':
                filepath = f"exports/{name}_{timestamp}.pdf"
                chart.export_pdf(filepath)
            elif choice == '4':
                filepath = f"exports/{name}_{timestamp}.html"
                chart.export_html(filepath)

            print(f"{Fore.GREEN}Chart exported to: {filepath}{Style.RESET_ALL}")

        except Exception as e:
            print(f"{Fore.RED}Error exporting chart: {str(e)}{Style.RESET_ALL}")

    def _change_color_scheme(self, chart):
        """Change chart color scheme"""
        try:
            print("\nColor Schemes:")
            print("1. 🌈 Default")
            print("2. 🎨 High Contrast")
            print("3. 🌗 Light/Dark")
            print("4. 📊 Data-Driven")
            print("5. 🎯 Custom")

            choice = input(f"\n{Fore.YELLOW}Select color scheme: {Style.RESET_ALL}")

            schemes = {
                '1': self.visualizer.color_schemes['default'],
                '2': self.visualizer.color_schemes['high_contrast'],
                '3': self.visualizer.color_schemes['light_dark'],
                '4': self.visualizer.color_schemes['data_driven']
            }

            if choice == '5':
                self._set_custom_colors(chart)
            elif choice in schemes:
                chart.update_style({'colors': schemes[choice]})
                print(f"{Fore.GREEN}Color scheme updated!{Style.RESET_ALL}")

        except Exception as e:
            print(f"{Fore.RED}Error changing color scheme: {str(e)}{Style.RESET_ALL}")

    def _set_custom_colors(self, chart):
        """Set custom color scheme"""
        try:
            print("\nEnter colors in hex format (e.g., #FF0000)")
            primary = input("Primary color: ")
            secondary = input("Secondary color: ")
            accent = input("Accent color: ")

            chart.update_style({
                'colors': {
                    'primary': primary,
                    'secondary': secondary,
                    'accent': accent
                }
            })
            print(f"{Fore.GREEN}Custom colors applied!{Style.RESET_ALL}")

        except Exception as e:
            print(f"{Fore.RED}Error setting custom colors: {str(e)}{Style.RESET_ALL}")

    def show_advanced_visualization(self):
        """Show advanced visualization options"""
        try:
            team = self._get_team_selection()
            if not team:
                return

            print(f"\n{Fore.CYAN}Advanced Visualization Suite - {team}{Style.RESET_ALL}")

            # Enhanced visualization types
            charts = {
                'performance_radar': self.visualizer.create_advanced_radar(
                    self.data_handler.get_performance_metrics(team),
                    interactive=True,
                    animated=True
                ),
                'timeline_analysis': self.visualizer.create_dynamic_timeline(
                    self.data_handler.get_timeline_data(team),
                    with_annotations=True
                ),
                'momentum_chart': self.visualizer.create_momentum_visualization(
                    self.data_handler.get_momentum_data(team)
                ),
                'tactical_heatmap': self.visualizer.create_tactical_heatmap(
                    self.data_handler.get_tactical_data(team),
                    with_zones=True
                ),
                'player_network': self.visualizer.create_interactive_network(
                    self.data_handler.get_player_interaction_data(team)
                )
            }

            self._show_enhanced_visualization_controls(charts, team)

        except Exception as e:
            print(f"{Fore.RED}Error in advanced visualization: {str(e)}{Style.RESET_ALL}")

    def _show_enhanced_visualization_controls(self, charts: Dict, team: str):
        """Enhanced visualization control panel"""
        while True:
            print(f"\n{Fore.CYAN}Advanced Visualization Controls{Style.RESET_ALL}")
            print("1. 🎯 Performance Radar")
            print("2. ⏱️ Timeline Analysis")
            print("3. 📈 Momentum Chart")
            print("4. 🌡️ Tactical Heatmap")
            print("5. 🕸️ Player Network")
            print("6. 🎨 Visual Settings")
            print("7. 🔄 Real-time Updates")
            print("8. 💾 Export Options")
            print("9. 🔍 Data Explorer")
            print("10. ⬅️ Back")

            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

            if choice == '1':
                self._show_performance_radar_controls(charts['performance_radar'])
            elif choice == '2':
                self._show_timeline_controls(charts['timeline_analysis'])
            elif choice == '3':
                self._show_momentum_controls(charts['momentum_chart'])
            elif choice == '4':
                self._show_heatmap_controls(charts['tactical_heatmap'])
            elif choice == '5':
                self._show_network_controls(charts['player_network'])
            elif choice == '6':
                self._show_visual_settings(charts)
            elif choice == '7':
                self._configure_real_time_updates(charts)
            elif choice == '8':
                self._show_enhanced_export_options(charts, team)
            elif choice == '9':
                self._show_data_explorer(team)
            elif choice == '10':
                break

    def _show_performance_radar_controls(self, chart):
        """Enhanced radar chart controls"""
        while True:
            print(f"\n{Fore.CYAN}Radar Chart Controls{Style.RESET_ALL}")
            print("1. 🔄 Rotate Chart")
            print("2. 📊 Change Metrics")
            print("3. 🎨 Adjust Colors")
            print("4. 📐 Change Scale")
            print("5. 🔍 Zoom Controls")
            print("6. 🎞️ Animation Settings")
            print("7. 📏 Axis Settings")
            print("8. 💾 Export Options")
            print("9. ⬅️ Back")

            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

            try:
                if choice == '1':
                    self._rotate_radar(chart)
                elif choice == '2':
                    self._change_radar_metrics(chart)
                elif choice == '3':
                    self._adjust_radar_colors(chart)
                elif choice == '4':
                    self._change_radar_scale(chart)
                elif choice == '5':
                    self._handle_radar_zoom(chart)
                elif choice == '6':
                    self._configure_radar_animation(chart)
                elif choice == '7':
                    self._configure_radar_axes(chart)
                elif choice == '8':
                    self._export_radar(chart)
                elif choice == '9':
                    break

            except Exception as e:
                print(f"{Fore.RED}Error in radar controls: {str(e)}{Style.RESET_ALL}")

    def _configure_radar_animation(self, chart):
        """Configure radar chart animations"""
        print("\nAnimation Settings:")
        print("1. 🎞️ Animation Speed")
        print("2. 🔄 Transition Type")
        print("3. 📊 Data Update Animation")
        print("4. 🎨 Color Transition")

        choice = input(f"\n{Fore.YELLOW}Select setting: {Style.RESET_ALL}")

        try:
            if choice == '1':
                speed = input("Enter animation speed (0.1-2.0): ")
                chart.update_animation_settings({'duration': float(speed)})
            elif choice == '2':
                self._set_transition_type(chart)
            elif choice == '3':
                self._configure_data_animation(chart)
            elif choice == '4':
                self._configure_color_transition(chart)

        except Exception as e:
            print(f"{Fore.RED}Error configuring animation: {str(e)}{Style.RESET_ALL}")

    def _configure_real_time_updates(self, charts: Dict):
        """Configure real-time data updates"""
        print(f"\n{Fore.CYAN}Real-time Update Configuration{Style.RESET_ALL}")
        print("1. 🔄 Update Interval")
        print("2. 📊 Data Sources")
        print("3. 🎯 Update Triggers")
        print("4. 📈 Animation Settings")

        choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

        try:
            if choice == '1':
                interval = input("Enter update interval (seconds): ")
                self._set_update_interval(int(interval))
            elif choice == '2':
                self._configure_data_sources()
            elif choice == '3':
                self._set_update_triggers()
            elif choice == '4':
                self._configure_update_animations()

        except Exception as e:
            print(f"{Fore.RED}Error configuring updates: {str(e)}{Style.RESET_ALL}")

    def _show_data_explorer(self, team: str):
        """Interactive data exploration interface"""
        while True:
            print(f"\n{Fore.CYAN}Data Explorer{Style.RESET_ALL}")
            print("1. 📊 Explore Metrics")
            print("2. 🔍 Find Patterns")
            print("3. 📈 Create Custom Visualization")
            print("4. 📊 Compare Periods")
            print("5. 🔄 Real-time Analysis")
            print("6. 💾 Export Findings")
            print("7. ⬅️ Back")

            choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

            try:
                if choice == '1':
                    self._explore_metrics(team)
                elif choice == '2':
                    self._find_patterns(team)
                elif choice == '3':
                    self._create_custom_viz(team)
                elif choice == '4':
                    self._compare_periods(team)
                elif choice == '5':
                    self._show_real_time_analysis(team)
                elif choice == '6':
                    self._export_findings(team)
                elif choice == '7':
                    break

            except Exception as e:
                print(f"{Fore.RED}Error in data explorer: {str(e)}{Style.RESET_ALL}")

    # Continuing enhanced main.py...

    def _show_interactive_analysis_dashboard(self, team: str):
        """Show comprehensive interactive analysis dashboard"""
        try:
            analysis_data = self._load_analysis_data(team)
            
            while True:
                print(f"\n{Fore.CYAN}Interactive Analysis Dashboard - {team}{Style.RESET_ALL}")
                print("1. 🎯 Live Performance Tracker")
                print("2. 📊 Dynamic Stats Comparison")
                print("3. 🔄 Form Cycle Analysis")
                print("4. 📈 Prediction Models")
                print("5. 🎨 Visualization Lab")
                print("6. 🔍 Deep Dive Analysis")
                print("7. 📱 Mobile View")
                print("8. 💾 Export Dashboard")
                print("9. ⬅️ Back")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")
                
                if choice == '1':
                    self._show_live_performance_tracker(analysis_data)
                elif choice == '2':
                    self._show_dynamic_stats_comparison(analysis_data)
                elif choice == '3':
                    self._analyze_form_cycles(analysis_data)
                elif choice == '4':
                    self._show_prediction_models(analysis_data)
                elif choice == '5':
                    self._open_visualization_lab(analysis_data)
                elif choice == '6':
                    self._show_deep_dive_analysis(analysis_data)
                elif choice == '7':
                    self._switch_to_mobile_view(analysis_data)
                elif choice == '8':
                    self._export_dashboard(analysis_data)
                elif choice == '9':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error in interactive dashboard: {str(e)}{Style.RESET_ALL}")

    def _show_live_performance_tracker(self, data: Dict):
        """Real-time performance tracking visualization"""
        try:
            chart = self.visualizer.create_live_tracker(data)
            
            while True:
                print(f"\n{Fore.CYAN}Live Performance Tracker Controls{Style.RESET_ALL}")
                print("1. 🔄 Update Frequency")
                print("2. 📊 Metric Selection")
                print("3. 📈 Chart Type")
                print("4. 🎨 Visual Theme")
                print("5. 🔔 Alert Settings")
                print("6. 💾 Save View")
                print("7. ⬅️ Back")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

                if choice == '1':
                    self._configure_update_frequency(chart)
                elif choice == '2':
                    self._select_tracking_metrics(chart)
                elif choice == '3':
                    self._change_chart_type(chart)
                elif choice == '4':
                    self._customize_theme(chart)
                elif choice == '5':
                    self._set_alert_thresholds(chart)
                elif choice == '6':
                    self._save_current_view(chart)
                elif choice == '7':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error in live tracker: {str(e)}{Style.RESET_ALL}")

    def _open_visualization_lab(self, data: Dict):
        """Advanced visualization laboratory"""
        try:
            while True:
                print(f"\n{Fore.CYAN}Visualization Lab{Style.RESET_ALL}")
                print("1. 🎨 Create New Visualization")
                print("2. 📊 Modify Existing Charts")
                print("3. 🔄 Combine Visualizations")
                print("4. 📱 Responsive Design")
                print("5. 🎞️ Animation Studio")
                print("6. 🎯 Interactive Elements")
                print("7. 💾 Save/Load Templates")
                print("8. ⬅️ Back")

                choice = input(f"\n{Fore.YELLOW}Select option: {Style.RESET_ALL}")

                if choice == '1':
                    self._create_new_visualization(data)
                elif choice == '2':
                    self._modify_existing_charts()
                elif choice == '3':
                    self._combine_visualizations()
                elif choice == '4':
                    self._adjust_responsive_design()
                elif choice == '5':
                    self._open_animation_studio()
                elif choice == '6':
                    self._add_interactive_elements()
                elif choice == '7':
                    self._manage_templates()
                elif choice == '8':
                    break

        except Exception as e:
            print(f"{Fore.RED}Error in visualization lab: {str(e)}{Style.RESET_ALL}")

    def _create_new_visualization(self, data: Dict):
        """Create new custom visualization"""
        try:
            print(f"\n{Fore.CYAN}Create New Visualization{Style.RESET_ALL}")
            
            # Step 1: Select Data
            print("\nStep 1: Select Data")
            available_metrics = self._get_available_metrics()
            selected_metrics = self._select_metrics(available_metrics)

            # Step 2: Choose Visualization Type
            print("\nStep 2: Choose Visualization Type")
            viz_type = self._choose_visualization_type()

            # Step 3: Configure Layout
            print("\nStep 3: Configure Layout")
            layout = self._configure_layout()

            # Step 4: Set Style
            print("\nStep 4: Set Style")
            style = self._configure_style()

            # Step 5: Add Interactivity
            print("\nStep 5: Add Interactivity")
            interactivity = self._configure_interactivity()

            # Create visualization
            chart = self.visualizer.create_custom_visualization(
                data=data,
                metrics=selected_metrics,
                viz_type=viz_type,
                layout=layout,
                style=style,
                interactivity=interactivity
            )

            # Preview and Save
            self._preview_and_save_visualization(chart)

        except Exception as e:
            print(f"{Fore.RED}Error creating visualization: {str(e)}{Style.RESET_ALL}")

    def _configure_interactivity(self) -> Dict:
        """Configure interactive elements for visualization"""
        interactivity = {
            'hover_effects': False,
            'click_actions': False,
            'drill_down': False,
            'filters': False,
            'tooltips': False,
            'animations': False
        }

        print("\nConfigure Interactivity:")
        print("1. Hover Effects")
        print("2. Click Actions")
        print("3. Drill Down")
        print("4. Filters")
        print("5. Tooltips")
        print("6. Animations")

        while True:
            choice = input(f"\n{Fore.YELLOW}Select feature to configure (or 'done'): {Style.RESET_ALL}")
            
            if choice.lower() == 'done':
                break

            try:
                if choice == '1':
                    interactivity['hover_effects'] = self._configure_hover_effects()
                elif choice == '2':
                    interactivity['click_actions'] = self._configure_click_actions()
                elif choice == '3':
                    interactivity['drill_down'] = self._configure_drill_down()
                elif choice == '4':
                    interactivity['filters'] = self._configure_filters()
                elif choice == '5':
                    interactivity['tooltips'] = self._configure_tooltips()
                elif choice == '6':
                    interactivity['animations'] = self._configure_animations()

            except Exception as e:
                print(f"{Fore.RED}Error configuring interactivity: {str(e)}{Style.RESET_ALL}")

        return interactivity
    
    

def main():
    predictor = EPLPredictor()
    predictor.run()

if __name__ == "__main__":
    main()
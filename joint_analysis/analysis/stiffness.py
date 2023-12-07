import itertools
from math import pi

from joint_analysis.analysis.jointdata import *
# from jointdata import *


class FastenerModel:
    def __init__(self, node: Node, connected_plates_ids: list, method_name: str):
        self.node = node
        fastener_id = node.fastener_id
        self.Ef = self.node.fastener_Ebb  # Fastener Youngs modulus
        self.Gf = self.node.fastener_Gb
        self.ftype = self.node.fastener_type
        self.diameter = self.node.get_diameter()
        self.fasteners_qty = self.node.fasteners_qty

        self.plates = []  # It's assumed that plates are sorted by coord_y
        self.plates_ids = connected_plates_ids
        self.plates_E = []  # Plates Youngs modulus
        for plate in node.plates:
            if plate.id in connected_plates_ids:
                self.plates.append(plate)
                # plate_E = materials_db[plate.material_id]['E']
                self.plates_E.append(plate.E)

        self.method_name = method_name
        fastener_elements_ids = list(itertools.combinations(connected_plates_ids, 2))
        self.fastener_elements_ids = [tuple(sorted(item)) for item in fastener_elements_ids]
        self.fastener_elements = {}
        for f_elm_id in self.fastener_elements_ids:
            (plate1_id, plate2_id) = f_elm_id
            print('self.method_name ********************************', self.method_name)
            stiffness = self.calculate_stiffness(plate1_id, plate2_id, self.method_name)

            f_elm = FastenerElement2(node.id, f_elm_id, stiffness, self.diameter, node.coord_x)
            self.fastener_elements[(plate1_id, plate2_id)] = f_elm
            adjacent_plates_pairs = self.node.adjacent_plates_pairs_between(plate1_id, plate2_id)
            f_elm.set_adjacent_plates_pairs(adjacent_plates_pairs)

    def calculate_stiffness(self, plate1_id, plate2_id, method_name) -> float:
        print('method_name **************************************', method_name)
        flexibilities = []
        adjacent_plates_pairs = self.node.adjacent_plates_pairs_between(plate1_id, plate2_id)
        for pair in adjacent_plates_pairs:
            [pl1_id, pl2_id] = pair
            if method_name == BOEING_METHOD:
                if adjacent_plates_pairs.index(pair) == 0:
                    bearing_component1 = self.boeing_bearing_flexibility(pl1_id)
                else:
                    bearing_component1 = 0.0

                if adjacent_plates_pairs.index(pair) == len(adjacent_plates_pairs) - 1:
                    bearing_component2 = self.boeing_bearing_flexibility(pl2_id)
                else:
                    bearing_component2 = 0.0
                shear_bending_components = self.boeing_shear_bending_flexibility(pl1_id, pl2_id)
                flexibility = shear_bending_components + bearing_component1 + bearing_component2
                flexibilities.append(flexibility)

            if method_name == DOUGLAS_METHOD:
                flexibilities.append(self.swift_douglas_flexibility(pl1_id, pl2_id))

            if method_name == AIRBUS_METHOD:
                flexibilities.append(self.huth_airbus_flexibility(pl1_id, pl2_id))

        stiffness = self.fasteners_qty / sum(flexibilities)
        return stiffness

    def boeing_shear_bending_flexibility(self, plate1_id, plate2_id) -> float:
        d = self.diameter
        Ib = pi * d **4 / 64
        Ab = pi * d **2 / 4
        Ebb = self.Ef
        Gb = self.Gf
        index1 = self.plates_ids.index(plate1_id)
        index2 = self.plates_ids.index(plate2_id)
        t1 = self.plates[index1].thickness
        t2 = self.plates[index2].thickness
        E1 = self.plates_E[index1]
        E2 = self.plates_E[index2]
        shear_component = 4 * (t1 + t2) / ( 9 * Gb * Ab)
        bending_component = (t1**3 + 5 * t1**2 * t2 + 5 * t1 * t2**2 + t2**3) / (40 * Ebb * Ib)
        shear_bending_components = shear_component + bending_component
        # print('plate1_id, plate2_id:', plate1_id, plate2_id)
        # print('shear_component:', 1/shear_component)
        # print('bending_component:', 1/bending_component)
        return shear_bending_components

    def boeing_bearing_flexibility(self, plate_id):
        index = self.plates_ids.index(plate_id)
        t = self.plates[index].thickness
        E = self.plates_E[index]
        Ebb = self.Ef
        bearing_component = (1 / Ebb + 1 / E) / t
        return bearing_component

    def swift_douglas_flexibility(self, plate1_id, plate2_id) -> float:
        """
        Swift (Douglas) method defines interplate fastener flexibility (between 2 adjacent plates)

        :param d: fastener diameter (min dia for screws)
        :param Ef: fastener material Young's modulus
        :param t1: plate1 thickness
        :param E1: plate1 material Young's modulus
        :param t2: plate2 thickness
        :param E2: plate2 material Young's modulus
        :return: fastener stiffness
        """
        d = self.diameter
        Ef = self.Ef
        index1 = self.plates_ids.index(plate1_id)
        index2 = self.plates_ids.index(plate2_id)
        t1 = self.plates[index1].thickness
        t2 = self.plates[index2].thickness
        E1 = self.plates_E[index1]
        E2 = self.plates_E[index2]
        flexibility = 5 / (d * Ef) + 0.8 * (1 / (t1 * E1) + 1 / (t2 * E2))
        return flexibility

    def huth_airbus_flexibility(self, plate1_id, plate2_id) -> float:
        d = self.diameter
        Ef = self.Ef
        index1 = self.plates_ids.index(plate1_id)
        index2 = self.plates_ids.index(plate2_id)
        t1 = self.plates[index1].thickness
        t2 = self.plates[index2].thickness
        E1 = self.plates_E[index1]
        E2 = self.plates_E[index2]
        n = 1  # Single shear coefficient
        if self.ftype == RIVET:
            # Riveted metallic joint
            a = 2/5
            b = 2.2
        if self.ftype == BOLT:
            # Bolted metallic joint
            a = 2/3
            b = 3
        flexibility = ((t1 + t2)/(2 *d))**a * b / n * (1/t1/E1 + 1/n/t2/E2 + 1/2/t1/Ef + 1/2/n/t2/Ef)
        return flexibility

    def get_fastener_element(self, plate1_id, plate2_id):
        elm_id = tuple(sorted([plate1_id, plate2_id]))
        fastener_elm = self.fastener_elements[elm_id]
        return fastener_elm

    def set_displacements(self, displacements_dict: dict):
        for fastener_elm_id in list(self.fastener_elements):
            fastener_elm = self.fastener_elements[fastener_elm_id]
            (node_id, plate1_id, plate2_id) = fastener_elm.id
            disp1 = displacements_dict[(node_id, plate1_id)]
            coord1_y = self.node.plate(plate1_id).coord_y
            disp2 = displacements_dict[(node_id, plate2_id)]
            coord2_y = self.node.plate(plate2_id).coord_y
            fastener_elm.set_displacements(plate1_id, coord1_y, disp1, plate2_id, coord2_y, disp2)

    def get_fasteners_elements(self) -> list:
        fastener_elements = []
        for fastener_elm_id in list(self.fastener_elements):
            fastener_elm = self.fastener_elements[fastener_elm_id]
            fastener_elements.append(fastener_elm)
        return fastener_elements

    def get_load_traffic_between(self, plate1_id, plate2_id):
        fastener_elements = self.get_fasteners_elements()
        load_traffic = 0
        for f_elm in fastener_elements:
            if {plate1_id, plate2_id} in f_elm.adjacent_plates_pairs:
                load_traffic = load_traffic + f_elm.end_load
        return  load_traffic

    def get_all_loads_traffics(self):
        plates = self.plates_ids
        loads_traffics = []
        for i in range(len(plates) - 1):
            plate1_id = plates[i]
            plate2_id = plates[i + 1]
            load_traffic = self.get_load_traffic_between(plate1_id, plate2_id)
            loads_traffics.append(load_traffic)
        return loads_traffics

    def get_all_loads_traffics_dict(self):
        plates = self.plates_ids
        loads_traffics = []
        for i in range(len(plates) - 1):
            lt_dict = {}
            plate1_id = plates[i]
            plate2_id = plates[i + 1]
            lt_value = self.get_load_traffic_between(plate1_id, plate2_id)
            lt_dict['plate1_id'] = plate1_id
            lt_dict['plate2_id'] = plate2_id
            lt_dict['load_traffic'] = lt_value
            loads_traffics.append(lt_dict)
        return loads_traffics


# class for stiffness determination depending on method
# class Stiffness:
#     """
#     Class contains various methods of fastener and plate stiffness definition.
#     """

    # @classmethod
    # def complex_flexibility_indices(cls, plates: list, plate1: int, plate2: int) -> list:
    #     """
    #     Supplemental method defining set of flexibility indices needed to be accounted in flexibility-to-stiffness
    #     inversion when obtaining interplate fastener stiffness. Provides complex indices tuples (len(list) > 2)
    #
    #     :param plates: indices of all plates presented in model
    #     :param plate1: index of the 1st plate
    #     :param plate2: index of the 2nd plate
    #     :return: list of indices tuples
    #     """
    #     all_combinations = []
    #     for i in range(2, len(plates) + 1):
    #         all_combinations.extend((list(itertools.combinations(plates, i))))
    #
    #     indices = []
    #     if plate1 > plate2:
    #         plate1, plate2 = plate2, plate1
    #     for item in all_combinations:
    #         if item[0] == plate1 and item[-1] == plate2:
    #             # TODO: edit this functionality to allow 1-3, 2-4, 1-4 etc connections
    #             for i, value in enumerate(item[:-1]):
    #                 if value + 1 != item[i + 1]:
    #                     break
    #             else:
    #                 indices.append(item)
    #     return indices

    # @classmethod
    # def unpack_flexibility_pair_indices(cls, complex_indices: list) -> list:
    #     """
    #     Supplemental method separating complex indices (len(list) > 2) onto 2-indices list combinations.
    #
    #     :param complex_indices: list of complex indices
    #     :return: list of paired indices
    #     """
    #     indices = []
    #     for i in range(len(complex_indices) - 1):
    #         indices.append([complex_indices[i], complex_indices[i + 1]])
    #     return indices

    # @classmethod
    # def flexibility_pairs(cls, plates: list, plate1: int, plate2: int) -> list:
    #     """
    #     Supplemental method defining list of flexibility pairs that needs to be taken into account in interplate
    #     stiffness calculation
    #
    #     :param plates: indices of all plates presented in model
    #     :param plate1: index of the 1st plate
    #     :param plate2: index of the 2nd plate
    #     :return: total list of paired indices
    #     """
    #     flex_ids_for_stiff = cls.complex_flexibility_indices(plates, plate1, plate2)
    #     flex_ids_pairs = []
    #     for item in flex_ids_for_stiff:
    #         flex_ids_pairs.extend(cls.unpack_flexibility_pair_indices(item))
    #     return flex_ids_pairs

    # @classmethod
    # def swift_douglas_flexibility(cls, d: float, Ef: float, t1: float, E1: float, t2: float, E2: float) -> float:
    #     """
    #     Swift (Douglas) method defines interplate fastener flexibility (2 plates)
    #
    #     :param d: fastener diameter (min dia for screws)
    #     :param Ef: fastener material Young's modulus
    #     :param t1: plate1 thickness
    #     :param E1: plate1 material Young's modulus
    #     :param t2: plate2 thickness
    #     :param E2: plate2 material Young's modulus
    #     :return: fastener stiffness
    #     """
    #     flexibility = 5 / (d * Ef) + 0.8 * (1 / (t1 * E1) + 1 / (t2 * E2))
    #     return flexibility

    # @classmethod
    # def interplate_stiffness(cls, flexibilities: list) -> float:
    #     """
    #     Method combining several flexibilities in order to obtain complex stiffness (several plates)
    #
    #     :param flexibilities: list of pair flexibilities
    #     :return: fastener stiffness
    #     """
    #     return 1 / sum(flexibilities)

    # @classmethod
    # def straight_plate(cls, E: float, W: float, t: float, L: float) -> float:
    #     """
    #     Method defines stiffness value of the constant-thickness (straight) plate
    #
    #     :param E: plate Young's modulus
    #     :param W: plate width
    #     :param t: plate thickness
    #     :param L: plate length (spacing)
    #     :return: plate stiffness
    #     """
    #     return E * W * t / L
